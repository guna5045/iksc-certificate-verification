import React, { useState, useEffect } from 'react';
import { certificateService } from '../services/certificateService';
import { importerService } from '../services/importerService';
import { qrZipService } from '../services/qrZipService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { EventInfo, CertificateRecord, SpreadsheetValidationResult } from '../types/certificate';
import { authenticateAdmin } from '../services/authService';
import { getProductionBaseUrl } from '../services/urlConfig';
import QRCode from 'qrcode';

type AdminTab = 'dashboard' | 'events' | 'certificates' | 'add-event' | 'import';

export const AdminPage: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');

  // Master Data State
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [, setDataLoading] = useState<boolean>(false);

  // Filter & Search State for Certificates
  const [filterEventId, setFilterEventId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Event Form State
  const [newEventName, setNewEventName] = useState('');
  const [newEventCode, setNewEventCode] = useState('');
  const [newEventYear, setNewEventYear] = useState('2026');
  const [newEventDates, setNewEventDates] = useState('');
  const [eventMsg, setEventMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Import Spreadsheet State
  const [importEventId, setImportEventId] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [validationResult, setValidationResult] = useState<SpreadsheetValidationResult | null>(null);
  const [importing, setImporting] = useState<boolean>(false);
  const [importSuccess, setImportSuccess] = useState<{ count: number; event: EventInfo } | null>(null);

  // QR Download Progress
  const [qrDownloading, setQrDownloading] = useState<boolean>(false);
  const [qrProgress, setQrProgress] = useState<string>('');

  // Certificate Detail Modal State
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string>('');

  // Check existing Supabase auth session
  useEffect(() => {
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setIsAuthenticated(true);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  // Load data upon authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadAllData();
    }
  }, [isAuthenticated]);

  const loadAllData = async () => {
    setDataLoading(true);
    try {
      const evs = await certificateService.getEvents();
      setEvents(evs);
      if (evs.length > 0 && !importEventId) {
        setImportEventId(evs[0].id);
      }
      const certs = await certificateService.getCertificatesForAdmin();
      setCertificates(certs);
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setDataLoading(false);
    }
  };

  // -------------------------------------------------------------
  // AUTHENTICATION HANDLERS
  // -------------------------------------------------------------
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setAuthLoading(true);

    try {
      const { success, error } = await authenticateAdmin(email, password);
      if (success) {
        setIsAuthenticated(true);
        setPassword('');
      } else {
        setLoginError(error || 'Invalid email or password.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication error.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured() && supabase) {
      await supabase.auth.signOut();
    }
    setIsAuthenticated(false);
    setActiveTab('dashboard');
  };

  // -------------------------------------------------------------
  // EVENT CREATION
  // -------------------------------------------------------------
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventMsg(null);

    const code = newEventCode.trim().toUpperCase();
    const year = parseInt(newEventYear, 10);
    const name = newEventName.trim();
    const dates = newEventDates.trim();

    if (!name || !code || !year || !dates) {
      setEventMsg({ type: 'error', text: 'All fields (Name, Code, Year, Dates) are required.' });
      return;
    }

    const eventId = `${code}-${year}`;

    // Check duplicate
    const exists = events.some(ev => ev.id.toUpperCase() === eventId || (ev.code === code && ev.year === year));
    if (exists) {
      setEventMsg({ type: 'error', text: `An event with Code "${code}" and Year "${year}" already exists.` });
      return;
    }

    const newEvent: EventInfo = {
      id: eventId,
      code,
      name,
      year,
      dates,
      organizer: 'IUCEE KARE Student Chapter',
      description: `Official event organized by IUCEE KARE Student Chapter.`
    };

    try {
      await certificateService.addEvent(newEvent);
      setEventMsg({ type: 'success', text: `Event "${name}" (${eventId}) created successfully!` });
      setNewEventName('');
      setNewEventCode('');
      setNewEventDates('');
      await loadAllData();
    } catch (err: any) {
      setEventMsg({ type: 'error', text: err.message || 'Failed to create event.' });
    }
  };

  // -------------------------------------------------------------
  // SPREADSHEET IMPORT & VALIDATION
  // -------------------------------------------------------------
  const processSpreadsheetFile = async (file: File) => {
    setImportSuccess(null);
    setSelectedFile(file);

    try {
      const rawRows = await importerService.parseFile(file);
      const targetEventId = importEventId || (events[0] ? events[0].id : 'EBTC-2026');
      const existingRegs = await certificateService.getExistingRegNumbersForEvent(targetEventId);
      const validation = importerService.validateRows(rawRows, existingRegs);
      setValidationResult(validation);
    } catch (err: any) {
      alert(`Error reading spreadsheet: ${err.message}`);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processSpreadsheetFile(e.target.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.invalidRows > 0 || !selectedFile) return;

    const targetEvent = events.find(ev => ev.id.toLowerCase() === importEventId.toLowerCase());
    if (!targetEvent) {
      alert('Selected event not found.');
      return;
    }

    setImporting(true);
    try {
      // Get current count for this event so serial numbers start after existing or at 0001
      const currentCount = await certificateService.getCertificateCountForEvent(targetEvent.id);
      const certsToInsert = importerService.generateCertificates(
        targetEvent,
        validationResult.rows.filter(r => r.errors.length === 0),
        currentCount
      );

      await certificateService.importBatchCertificates(certsToInsert);

      setImportSuccess({ count: certsToInsert.length, event: targetEvent });
      setSelectedFile(null);
      setValidationResult(null);
      await loadAllData();
    } catch (err: any) {
      alert(`Import failed: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  // -------------------------------------------------------------
  // QR CODE ZIP DOWNLOAD
  // -------------------------------------------------------------
  const handleDownloadQrZip = async (event: EventInfo) => {
    setQrDownloading(true);
    setQrProgress('Preparing QR codes...');

    try {
      const eventCerts = certificates.filter(c => c.eventId.toLowerCase() === event.id.toLowerCase());
      if (eventCerts.length === 0) {
        alert(`No certificates found for event ${event.name}.`);
        return;
      }

      await qrZipService.downloadEventQrZip(event, eventCerts, (current, total) => {
        setQrProgress(`Generating QR code ${current} of ${total}...`);
      });

      setQrProgress('Download started!');
      setTimeout(() => setQrProgress(''), 3000);
    } catch (err: any) {
      alert(`Error generating QR ZIP: ${err.message}`);
    } finally {
      setQrDownloading(false);
    }
  };

  // -------------------------------------------------------------
  // CERTIFICATE STATUS TOGGLE & DETAILS MODAL
  // -------------------------------------------------------------
  const handleToggleStatus = async (cert: CertificateRecord) => {
    const nextStatus = cert.status === 'VALID' ? 'REVOKED' : 'VALID';
    try {
      await certificateService.updateCertificateStatus(cert.id, nextStatus);
      await loadAllData();
      if (selectedCert && selectedCert.id === cert.id) {
        setSelectedCert({ ...selectedCert, status: nextStatus });
      }
    } catch (err: any) {
      alert(`Failed to update certificate status: ${err.message}`);
    }
  };

  const handleOpenCertDetails = async (cert: CertificateRecord) => {
    setSelectedCert(cert);
    const origin = getProductionBaseUrl();
    const verifyUrl = `${origin}/verify?id=${encodeURIComponent(cert.id)}`;
    try {
      const qr = await QRCode.toDataURL(verifyUrl, { width: 200, margin: 1 });
      setModalQrUrl(qr);
    } catch {
      setModalQrUrl('');
    }
  };

  // Filter certificates
  const filteredCerts = certificates.filter(c => {
    const matchesEvent = filterEventId === 'all' || c.eventId.toLowerCase() === filterEventId.toLowerCase();
    const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
    const q = searchQuery.trim().toLowerCase();
    const matchesQuery = !q || 
      c.id.toLowerCase().includes(q) || 
      c.participantName.toLowerCase().includes(q) || 
      c.registrationNumber.toLowerCase().includes(q);
    return matchesEvent && matchesStatus && matchesQuery;
  });

  // Calculate stats
  const totalCertsCount = certificates.length;
  const validCertsCount = certificates.filter(c => c.status === 'VALID').length;
  const revokedCertsCount = certificates.filter(c => c.status === 'REVOKED').length;

  // -------------------------------------------------------------
  // LOGIN SCREEN
  // -------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <div className="verify-container">
        <div className="verify-card">
          <div className="verify-header">
            <h1 className="verify-title">Admin Login</h1>
            <p className="verify-subtitle">IUCEE KARE Student Chapter Credential Authority</p>
          </div>

          <form className="verify-form" onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="admin-email-input" className="form-label">Email</label>
              <input
                id="admin-email-input"
                type="email"
                className="form-input"
                placeholder="ikscadmin@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="admin-pwd-input" className="form-label">Password</label>
              <input
                id="admin-pwd-input"
                type="password"
                className="form-input"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {loginError && <div className="form-error">{loginError}</div>}

            <button type="submit" className="btn-verify" disabled={authLoading}>
              {authLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // AUTHENTICATED ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="admin-container">
      <div className="admin-card">
        {/* Top Header Bar */}
        <div className="admin-top-bar">
          <div>
            <h1 className="admin-title">IKSC Administration</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              IUCEE KARE Student Chapter Event & Certificate Management
            </p>
          </div>
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="admin-nav-tabs">
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'events' ? 'active' : ''}`}
            onClick={() => setActiveTab('events')}
          >
            Events ({events.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'certificates' ? 'active' : ''}`}
            onClick={() => setActiveTab('certificates')}
          >
            Certificates ({certificates.length})
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'add-event' ? 'active' : ''}`}
            onClick={() => { setActiveTab('add-event'); setEventMsg(null); }}
          >
            + Add Event
          </button>
          <button
            type="button"
            className={`admin-tab-btn ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => { setActiveTab('import'); setImportSuccess(null); }}
          >
            Upload Certificates
          </button>
        </div>

        {/* Global Progress / Alert Banner */}
        {qrDownloading && (
          <div style={{ backgroundColor: 'var(--primary-blue-light)', border: '1px solid var(--border-focus)', padding: '0.75rem 1rem', borderRadius: '4px', marginBottom: '1.25rem', color: 'var(--primary-blue)', fontWeight: 600, fontSize: '0.9rem' }}>
            {qrProgress}
          </div>
        )}

        {/* TAB 1: DASHBOARD OVERVIEW */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="stats-grid">
              <div className="stat-box">
                <span className="stat-label">Events</span>
                <span className="stat-num">{events.length}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Certificates</span>
                <span className="stat-num">{totalCertsCount}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Valid Records</span>
                <span className="stat-num" style={{ color: 'var(--status-verified)' }}>{validCertsCount}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Revoked</span>
                <span className="stat-num" style={{ color: 'var(--status-invalid)' }}>{revokedCertsCount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Registered Events</h2>
              <button 
                type="button" 
                className="btn-sm-action btn-action-blue"
                onClick={() => setActiveTab('add-event')}
              >
                + Add New Event
              </button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event Name</th>
                    <th>Code</th>
                    <th>Year</th>
                    <th>Date</th>
                    <th>Certificates</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => {
                    const certCount = certificates.filter(c => c.eventId.toLowerCase() === ev.id.toLowerCase()).length;
                    return (
                      <tr key={ev.id}>
                        <td><strong>{ev.name}</strong></td>
                        <td><code>{ev.code}</code></td>
                        <td>{ev.year}</td>
                        <td>{ev.dates}</td>
                        <td><strong>{certCount}</strong></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn-sm-action"
                              onClick={() => {
                                setFilterEventId(ev.id);
                                setActiveTab('certificates');
                              }}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="btn-sm-action btn-action-blue"
                              onClick={() => {
                                setImportEventId(ev.id);
                                setActiveTab('import');
                              }}
                            >
                              Upload Sheet
                            </button>
                            {certCount > 0 && (
                              <button
                                type="button"
                                className="btn-sm-action"
                                onClick={() => handleDownloadQrZip(ev)}
                                disabled={qrDownloading}
                              >
                                Download QR ZIP
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: EVENTS DIRECTORY & ISOLATED VIEW */}
        {activeTab === 'events' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>IKSC Chapter Events</h2>
              <button
                type="button"
                className="btn-sm-action btn-action-blue"
                onClick={() => setActiveTab('add-event')}
              >
                + Create Event
              </button>
            </div>

            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Event Name</th>
                    <th>Dates</th>
                    <th>Certificates Issued</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(ev => {
                    const certCount = certificates.filter(c => c.eventId.toLowerCase() === ev.id.toLowerCase()).length;
                    return (
                      <tr key={ev.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{ev.id}</td>
                        <td><strong>{ev.name}</strong></td>
                        <td>{ev.dates}</td>
                        <td><strong>{certCount} Certificates</strong></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="btn-sm-action"
                              onClick={() => {
                                setFilterEventId(ev.id);
                                setActiveTab('certificates');
                              }}
                            >
                              View Certificates
                            </button>
                            <button
                              type="button"
                              className="btn-sm-action btn-action-blue"
                              onClick={() => {
                                setImportEventId(ev.id);
                                setActiveTab('import');
                              }}
                            >
                              Upload Sheet
                            </button>
                            {certCount > 0 && (
                              <button
                                type="button"
                                className="btn-sm-action"
                                onClick={() => handleDownloadQrZip(ev)}
                                disabled={qrDownloading}
                              >
                                Download QR ZIP
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: CERTIFICATE MANAGEMENT (Search, Filter, Revoke, Restore) */}
        {activeTab === 'certificates' && (
          <div>
            {/* Filter Bar */}
            <div className="admin-input-row">
              <div style={{ flex: '1 1 200px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by ID, Name, or Registration No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div style={{ width: '220px' }}>
                <select
                  className="form-select"
                  value={filterEventId}
                  onChange={(e) => setFilterEventId(e.target.value)}
                >
                  <option value="all">All Events ({events.length})</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.name} ({ev.code})</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '150px' }}>
                <select
                  className="form-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="VALID">VALID</option>
                  <option value="REVOKED">REVOKED</option>
                </select>
              </div>
            </div>

            {/* Event-specific header if event is filtered */}
            {filterEventId !== 'all' && (
              <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.65rem 1rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Filtering for Event: <strong>{events.find(e => e.id === filterEventId)?.name || filterEventId}</strong> ({filteredCerts.length} certificates)
                </span>
                <button 
                  type="button" 
                  className="btn-sm-action"
                  onClick={() => setFilterEventId('all')}
                >
                  Show All Events
                </button>
              </div>
            )}

            {/* Certificates Table */}
            <div className="table-responsive">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Certificate ID</th>
                    <th>Participant Name</th>
                    <th>Reg No</th>
                    <th>Department & Year</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCerts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No certificates match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredCerts.slice(0, 100).map(cert => (
                      <tr key={cert.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-blue)' }}>
                          {cert.id}
                        </td>
                        <td><strong>{cert.participantName}</strong></td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{cert.registrationNumber}</td>
                        <td style={{ fontSize: '0.84rem' }}>{cert.department} • {cert.yearOfStudy}</td>
                        <td><code>{cert.eventId}</code></td>
                        <td>
                          <span className={cert.status === 'VALID' ? 'badge-valid' : 'badge-revoked'}>
                            {cert.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="btn-sm-action"
                              onClick={() => handleOpenCertDetails(cert)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className={`btn-sm-action ${cert.status === 'VALID' ? 'btn-action-red' : 'btn-action-green'}`}
                              onClick={() => handleToggleStatus(cert)}
                            >
                              {cert.status === 'VALID' ? 'Revoke' : 'Restore'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filteredCerts.length > 100 && (
              <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Showing first 100 of {filteredCerts.length} matching certificates.
              </p>
            )}
          </div>
        )}

        {/* TAB 4: ADD NEW EVENT */}
        {activeTab === 'add-event' && (
          <div style={{ maxWidth: '680px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>Create New Event</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Every event gets an independent serial numbering sequence starting at 0001.
            </p>

            <form className="admin-grid-form" onSubmit={handleCreateEvent}>
              <div className="form-group full-col">
                <label className="form-label">Event Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Engineering Beyond the Classroom"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Event Code (Unique)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. EBTC"
                  value={newEventCode}
                  onChange={(e) => setNewEventCode(e.target.value.toUpperCase())}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Event Year</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="2026"
                  value={newEventYear}
                  onChange={(e) => setNewEventYear(e.target.value)}
                  required
                />
              </div>

              <div className="form-group full-col">
                <label className="form-label">Event Dates</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. 15th and 16th August 2026"
                  value={newEventDates}
                  onChange={(e) => setNewEventDates(e.target.value)}
                  required
                />
              </div>

              {eventMsg && (
                <div 
                  className="form-group full-col"
                  style={{ 
                    color: eventMsg.type === 'success' ? 'var(--status-verified)' : 'var(--status-invalid)',
                    fontSize: '0.9rem',
                    fontWeight: 600
                  }}
                >
                  {eventMsg.text}
                </div>
              )}

              <div className="form-group full-col" style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn-verify" style={{ width: 'auto' }}>
                  Create Event
                </button>
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => setActiveTab('events')}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 5: UPLOAD & IMPORT SPREADSHEET (CSV / XLSX) */}
        {activeTab === 'import' && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.35rem' }}>Upload Participant Spreadsheet</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
              Upload an Excel (.xlsx) or CSV file. All records will be validated prior to database insertion.
            </p>

            {/* Target Event Selector */}
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label">Select Target Event</label>
              <select
                className="form-select"
                value={importEventId}
                onChange={(e) => {
                  setImportEventId(e.target.value);
                  setValidationResult(null);
                  setSelectedFile(null);
                }}
              >
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name} ({ev.code}-{ev.year})
                  </option>
                ))}
              </select>
            </div>

            {/* Dropzone */}
            <label
              className={`upload-dropzone ${isDragging ? 'drag-over' : ''}`}
              htmlFor="spreadsheet-file-input"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processSpreadsheetFile(e.dataTransfer.files[0]);
                }
              }}
            >
              <input
                id="spreadsheet-file-input"
                type="file"
                accept=".xlsx, .xls, .csv"
                className="upload-file-input"
                onChange={handleFileChange}
              />
              <div className="upload-icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <div className="upload-heading">Upload Participant Spreadsheet</div>
              <div className="upload-prompt">
                {selectedFile ? selectedFile.name : 'Click to select Excel (.xlsx) or CSV file'}
              </div>
              <div className="upload-sub">
                Required columns:<br />
                <strong>Full Name</strong>, <strong>Registration Number</strong>, <strong>Year</strong>, <strong>Department</strong>
              </div>
            </label>

            {/* Validation Result Preview */}
            {validationResult && (
              <div className="preview-summary-box">
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem' }}>Import Preview</h3>
                
                <div className="preview-stat-row">
                  <div className="preview-stat-item">
                    <span className="stat-label">Total Rows</span>
                    <span className="preview-stat-val">{validationResult.totalRows}</span>
                  </div>
                  <div className="preview-stat-item">
                    <span className="stat-label">Valid Rows</span>
                    <span className="preview-stat-val text-green">{validationResult.validRows}</span>
                  </div>
                  <div className="preview-stat-item">
                    <span className="stat-label">Invalid Rows</span>
                    <span className={`preview-stat-val ${validationResult.invalidRows > 0 ? 'text-red' : ''}`}>
                      {validationResult.invalidRows}
                    </span>
                  </div>
                </div>

                {/* Validation Errors List */}
                {validationResult.invalidRows > 0 && (
                  <div className="preview-error-list">
                    <strong>Please correct the following errors before importing:</strong>
                    <ul>
                      {validationResult.errorSummary.slice(0, 15).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    </ul>
                    {validationResult.errorSummary.length > 15 && (
                      <p style={{ marginTop: '0.35rem' }}>+ {validationResult.errorSummary.length - 15} more errors.</p>
                    )}
                  </div>
                )}

                {/* Valid Preview Table (First 5 Rows) */}
                {validationResult.validRows > 0 && validationResult.invalidRows === 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Sample Record Preview (First 5 Rows):
                    </h4>
                    <div className="table-responsive" style={{ marginBottom: '1rem' }}>
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Participant Name</th>
                            <th>Reg No</th>
                            <th>Department</th>
                            <th>Year</th>
                          </tr>
                        </thead>
                        <tbody>
                          {validationResult.rows.slice(0, 5).map(r => (
                            <tr key={r.rowNumber}>
                              <td>{r.rowNumber}</td>
                              <td><strong>{r.fullName}</strong></td>
                              <td><code>{r.registrationNumber}</code></td>
                              <td>{r.department}</td>
                              <td>{r.year}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <button
                        type="button"
                        className="btn-verify"
                        style={{ width: 'auto' }}
                        onClick={handleExecuteImport}
                        disabled={importing}
                      >
                        {importing ? 'Importing...' : `Import ${validationResult.validRows} Certificates`}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => { setValidationResult(null); setSelectedFile(null); }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success Notification & Direct QR Download */}
            {importSuccess && (
              <div style={{ backgroundColor: 'var(--status-verified-bg)', border: '1.5px solid var(--status-verified-border)', borderRadius: '6px', padding: '1.5rem', marginTop: '1.5rem', textAlign: 'center' }}>
                <h3 style={{ color: 'var(--status-verified)', fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                  Certificates Imported Successfully!
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', marginBottom: '1.25rem' }}>
                  Total Certificates: <strong>{importSuccess.count}</strong> &bull; Event: <strong>{importSuccess.event.name}</strong> ({importSuccess.event.id})
                </p>

                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
                  <button
                    type="button"
                    className="btn-verify"
                    style={{ width: 'auto' }}
                    onClick={() => handleDownloadQrZip(importSuccess.event)}
                    disabled={qrDownloading}
                  >
                    Download QR Codes ({importSuccess.count})
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setFilterEventId(importSuccess.event.id);
                      setActiveTab('certificates');
                    }}
                  >
                    View in Certificates Tab
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DETAIL VIEW MODAL */}
      {selectedCert && (
        <div className="modal-overlay" onClick={() => setSelectedCert(null)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>Certificate Details</h3>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-blue)', fontWeight: 600 }}>{selectedCert.id}</span>
              </div>
              <button 
                type="button" 
                className="btn-secondary" 
                style={{ padding: '0.2rem 0.5rem' }} 
                onClick={() => setSelectedCert(null)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              <div><strong>Participant:</strong> {selectedCert.participantName}</div>
              <div><strong>Registration No:</strong> <code>{selectedCert.registrationNumber}</code></div>
              <div><strong>Year & Department:</strong> {selectedCert.yearOfStudy} • {selectedCert.department}</div>
              <div><strong>Event:</strong> {selectedCert.eventName} (<code>{selectedCert.eventId}</code>)</div>
              <div><strong>Date:</strong> {selectedCert.eventDates}</div>
              <div><strong>Issued By:</strong> {selectedCert.issuedBy}</div>
              <div>
                <strong>Status:</strong>{' '}
                <span className={selectedCert.status === 'VALID' ? 'badge-valid' : 'badge-revoked'}>
                  {selectedCert.status}
                </span>
              </div>
            </div>

            {/* QR preview in modal (Internal destination only - no visible raw URL) */}
            {modalQrUrl && (
              <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--bg-surface)', borderRadius: '4px', marginBottom: '1.25rem' }}>
                <img src={modalQrUrl} alt="QR Code" style={{ width: '160px', height: '160px', display: 'inline-block' }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className={`btn-sm-action ${selectedCert.status === 'VALID' ? 'btn-action-red' : 'btn-action-green'}`}
                onClick={() => handleToggleStatus(selectedCert)}
              >
                {selectedCert.status === 'VALID' ? 'Revoke Certificate' : 'Restore Certificate to VALID'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedCert(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
