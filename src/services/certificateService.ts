import { CertificateRecord, EventInfo, VerificationResult } from '../types/certificate';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import defaultEvents from '../data/events.json';
import ebtcCertificates from '../data/certificates/ebtc-2026.json';

// Standard IKSC ID Regex: e.g. IKSC-EBTC-2026-0001
export const CERTIFICATE_ID_REGEX = /^IKSC-[A-Z0-9]+-\d{4}-\d{4}$/i;

const STORAGE_EVENTS_KEY = 'iksc_events_v2';
const STORAGE_CERTS_KEY = 'iksc_certificates_v2';

function loadStoredEvents(): EventInfo[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem('iksc_events'); // Purge legacy cache
      const stored = localStorage.getItem(STORAGE_EVENTS_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored events:', e);
    }
  }
  return [...(defaultEvents as EventInfo[])];
}

function loadStoredCertificates(): CertificateRecord[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.removeItem('iksc_certificates'); // Purge legacy cache
      const stored = localStorage.getItem(STORAGE_CERTS_KEY);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Reject any legacy cache that might contain fake mock data
          const hasStaleMock = parsed.some(
            c => (c.participantName && c.participantName.includes('GOKUL')) ||
                 (c.id === 'IKSC-EBTC-2026-0003' && c.participantName !== 'BATTU VENU GOPAL')
          );
          if (!hasStaleMock) {
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored certificates:', e);
    }
  }
  return [...(ebtcCertificates as CertificateRecord[])];
}

function saveStoredEvents(events: EventInfo[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_EVENTS_KEY, JSON.stringify(events));
    } catch (e) {
      console.warn('Failed to save events to storage:', e);
    }
  }
}

function saveStoredCertificates(certs: CertificateRecord[]): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_CERTS_KEY, JSON.stringify(certs));
    } catch (e) {
      console.warn('Failed to save certificates to storage:', e);
    }
  }
}

class CertificateService {
  private localEvents: EventInfo[] = [];
  private localCertificates: CertificateRecord[] = [];
  private isLoaded = false;

  private async ensureLocalDataLoaded(): Promise<void> {
    if (!this.isLoaded) {
      this.localEvents = loadStoredEvents();
      this.localCertificates = loadStoredCertificates();
      this.isLoaded = true;
    }
  }

  public normalizeId(rawId: string | null | undefined): string {
    if (!rawId) return '';
    return decodeURIComponent(rawId).trim().toUpperCase();
  }

  public isValidIdFormat(id: string): boolean {
    return CERTIFICATE_ID_REGEX.test(id.trim());
  }

  /**
   * Fetch all events for public selector and admin list
   */
  public async getEvents(): Promise<EventInfo[]> {
    await this.ensureLocalDataLoaded();
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, code, name, year, dates, organizer, description')
          .order('year', { ascending: false });

        if (!error && data && data.length > 0) {
          this.localEvents = data as EventInfo[];
          saveStoredEvents(this.localEvents);
          return this.localEvents;
        }
      } catch (err) {
        console.warn('Falling back to local events list', err);
      }
    }
    return this.localEvents;
  }

  public async getEventById(eventId: string): Promise<EventInfo | undefined> {
    const events = await this.getEvents();
    return events.find(e => e.id.toLowerCase() === eventId.toLowerCase());
  }

  /**
   * PUBLIC VERIFICATION
   * - If eventId is provided (from public form): Query enforces BOTH id AND event_id!
   * - If eventId is omitted (from direct QR scan): Queries exact certificate by id!
   */
  public async verifyCertificate(rawId: string, eventId?: string): Promise<VerificationResult> {
    const id = this.normalizeId(rawId);

    if (!id) {
      return {
        state: 'INVALID_FORMAT',
        searchedId: '',
        errorMessage: 'Please enter a Certificate ID.'
      };
    }

    if (!this.isValidIdFormat(id)) {
      return {
        state: 'NOT_FOUND',
        searchedId: id,
        errorMessage: 'The certificate ID could not be verified.'
      };
    }

    await this.ensureLocalDataLoaded();

    // 1. Supabase Mode: Database level event separation
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('certificates')
          .select('id, event_id, participant_name, registration_number, year_of_study, department, certificate_type, issue_date, status, events(id, name, dates, organizer)')
          .eq('id', id);

        if (eventId) {
          query = query.eq('event_id', eventId);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
          return {
            state: 'NOT_FOUND',
            searchedId: id,
            errorMessage: eventId
              ? 'The certificate ID does not belong to the selected event.'
              : 'The certificate ID could not be verified.'
          };
        }

        const cert: CertificateRecord = {
          id: data.id,
          eventId: data.event_id,
          participantName: data.participant_name,
          registrationNumber: data.registration_number,
          yearOfStudy: data.year_of_study,
          department: data.department,
          eventName: (data.events as any)?.name || 'Engineering Beyond the Classroom',
          eventDates: (data.events as any)?.dates || '15th and 16th August 2026',
          issuedBy: 'IUCEE KARE Student Chapter',
          certificateType: data.certificate_type,
          issueDate: data.issue_date,
          status: data.status
        };

        if (cert.status === 'REVOKED' || cert.status === 'SUSPENDED') {
          return {
            state: 'REVOKED',
            certificate: cert,
            searchedId: id,
            errorMessage: 'This certificate is currently not valid.'
          };
        }

        return {
          state: 'VERIFIED',
          certificate: cert,
          searchedId: id
        };
      } catch (err) {
        console.error('Database query error:', err);
      }
    }

    // 2. Production Unified Local Data Mode
    const foundCert = this.localCertificates.find(c => c.id.toUpperCase() === id);

    if (!foundCert) {
      return {
        state: 'NOT_FOUND',
        searchedId: id,
        errorMessage: 'The certificate ID could not be verified.'
      };
    }

    // Enforce strict event isolation in local mode
    if (eventId && foundCert.eventId.toLowerCase() !== eventId.toLowerCase()) {
      return {
        state: 'NOT_FOUND',
        searchedId: id,
        errorMessage: 'The certificate ID does not belong to the selected event.'
      };
    }

    if (foundCert.status === 'REVOKED' || foundCert.status === 'SUSPENDED') {
      return {
        state: 'REVOKED',
        certificate: foundCert,
        searchedId: id,
        errorMessage: 'This certificate is currently not valid.'
      };
    }

    return {
      state: 'VERIFIED',
      certificate: foundCert,
      searchedId: id
    };
  }

  // -------------------------------------------------------------
  // ADMIN OPERATIONS (Authenticated)
  // -------------------------------------------------------------

  public async addEvent(newEvent: EventInfo): Promise<void> {
    await this.ensureLocalDataLoaded();
    const existing = this.localEvents.find(
      e => e.id.toLowerCase() === newEvent.id.toLowerCase() || 
           (e.code.toUpperCase() === newEvent.code.toUpperCase() && e.year === newEvent.year)
    );
    if (existing) {
      throw new Error(`Event with Code "${newEvent.code}" and Year "${newEvent.year}" already exists.`);
    }

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('events').insert({
        id: newEvent.id,
        code: newEvent.code,
        name: newEvent.name,
        year: newEvent.year,
        dates: newEvent.dates,
        organizer: newEvent.organizer || 'IUCEE KARE Student Chapter',
        description: newEvent.description
      });
      if (error) throw new Error(error.message);
    }
    
    this.localEvents.unshift(newEvent);
    saveStoredEvents(this.localEvents);
  }

  public async getCertificatesForAdmin(eventId?: string, limit = 1000): Promise<CertificateRecord[]> {
    await this.ensureLocalDataLoaded();
    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('certificates')
        .select('id, event_id, participant_name, registration_number, year_of_study, department, college_email, certificate_type, issue_date, status, events(name, dates)')
        .order('id', { ascending: true })
        .limit(limit);

      if (eventId && eventId !== 'all') {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map(d => ({
          id: d.id,
          eventId: d.event_id,
          participantName: d.participant_name,
          registrationNumber: d.registration_number,
          yearOfStudy: d.year_of_study,
          department: d.department,
          collegeEmail: d.college_email,
          eventName: (d.events as any)?.name || 'Event',
          eventDates: (d.events as any)?.dates || '',
          issuedBy: 'IUCEE KARE Student Chapter',
          certificateType: d.certificate_type,
          issueDate: d.issue_date,
          status: d.status
        }));
      }
    }

    // Local mode
    if (eventId && eventId !== 'all') {
      return this.localCertificates.filter(c => c.eventId.toLowerCase() === eventId.toLowerCase());
    }
    return this.localCertificates.slice(0, limit);
  }

  public async importBatchCertificates(certs: CertificateRecord[]): Promise<number> {
    if (certs.length === 0) return 0;
    await this.ensureLocalDataLoaded();

    if (isSupabaseConfigured() && supabase) {
      const rows = certs.map(c => ({
        id: c.id,
        event_id: c.eventId,
        participant_name: c.participantName,
        registration_number: c.registrationNumber,
        year_of_study: c.yearOfStudy,
        department: c.department,
        college_email: c.collegeEmail,
        certificate_type: c.certificateType,
        issue_date: c.issueDate,
        status: c.status
      }));

      const { error } = await supabase.from('certificates').insert(rows);
      if (error) throw new Error(error.message);
    }

    // Prevent duplicate entries by ID
    const map = new Map<string, CertificateRecord>();
    for (const c of this.localCertificates) {
      map.set(c.id.toUpperCase(), c);
    }
    for (const c of certs) {
      map.set(c.id.toUpperCase(), c);
    }
    this.localCertificates = Array.from(map.values());
    saveStoredCertificates(this.localCertificates);
    return certs.length;
  }

  /**
   * Resets local dataset to baseline production dataset (EBTC-2026 + 111 certs)
   */
  public async resetToProductionDataset(): Promise<void> {
    this.localEvents = [...(defaultEvents as EventInfo[])];
    this.localCertificates = [...(ebtcCertificates as CertificateRecord[])];
    saveStoredEvents(this.localEvents);
    saveStoredCertificates(this.localCertificates);
  }

  /**
   * Permanently deletes an event and all its associated certificates
   * Available only to authenticated admins
   */
  public async deleteEvent(eventId: string): Promise<void> {
    await this.ensureLocalDataLoaded();
    const cleanId = eventId.trim();

    // 1. Supabase Deletion
    if (isSupabaseConfigured() && supabase) {
      const { error: certsErr } = await supabase
        .from('certificates')
        .delete()
        .eq('event_id', cleanId);
      if (certsErr) {
        console.warn('Error deleting certificates for event:', certsErr);
      }

      const { error: eventErr } = await supabase
        .from('events')
        .delete()
        .eq('id', cleanId);
      if (eventErr) {
        throw new Error(eventErr.message);
      }
    }

    // 2. Local State Deletion
    this.localEvents = this.localEvents.filter(
      e => e.id.toLowerCase() !== cleanId.toLowerCase()
    );
    this.localCertificates = this.localCertificates.filter(
      c => c.eventId.toLowerCase() !== cleanId.toLowerCase()
    );
    saveStoredEvents(this.localEvents);
    saveStoredCertificates(this.localCertificates);
  }

  /**
   * Permanently deletes an individual certificate
   */
  public async deleteCertificate(certId: string): Promise<void> {
    await this.ensureLocalDataLoaded();
    const cleanId = certId.trim().toUpperCase();

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('certificates')
        .delete()
        .eq('id', cleanId);
      if (error) {
        throw new Error(error.message);
      }
    }

    this.localCertificates = this.localCertificates.filter(
      c => c.id.toUpperCase() !== cleanId
    );
    saveStoredCertificates(this.localCertificates);
  }

  public async updateCertificateStatus(id: string, status: 'VALID' | 'REVOKED'): Promise<void> {
    await this.ensureLocalDataLoaded();

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('certificates')
        .update({ status })
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    const c = this.localCertificates.find(cert => cert.id.toUpperCase() === id.toUpperCase());
    if (c) {
      c.status = status;
      saveStoredCertificates(this.localCertificates);
    }
  }

  public async getExistingRegNumbersForEvent(eventId: string): Promise<Set<string>> {
    const certs = await this.getCertificatesForAdmin(eventId);
    return new Set(certs.map(c => c.registrationNumber.toUpperCase()));
  }

  public async getCertificateCountForEvent(eventId: string): Promise<number> {
    const certs = await this.getCertificatesForAdmin(eventId);
    return certs.length;
  }
}

export const certificateService = new CertificateService();
