import React, { useState, useEffect } from 'react';
import { certificateService } from '../services/certificateService';
import { VerificationResult as IVerificationResult, EventInfo } from '../types/certificate';
import { VerificationResult } from '../components/VerificationResult';

interface HomePageProps {
  directId?: string;
  onVerifySubmit?: (id: string, eventId?: string) => void;
  onResetToHome?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ 
  directId, 
  onVerifySubmit, 
  onResetToHome 
}) => {
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [certificateId, setCertificateId] = useState<string>('');
  const [result, setResult] = useState<IVerificationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load events for the dropdown
  useEffect(() => {
    certificateService.getEvents().then(evs => {
      setEvents(evs);
    });
  }, []);

  // React cleanly to directId changes (direct QR URL scan, history push, or browser back button)
  useEffect(() => {
    if (directId) {
      setCertificateId(directId);
      performVerification(directId);
    } else {
      // directId was cleared (e.g. user pressed browser Back button or reset)
      setResult(null);
      setCertificateId('');
      setErrorMessage(null);
    }
  }, [directId]);

  const performVerification = async (idToVerify: string, eventIdToVerify?: string) => {
    const cleanId = idToVerify.trim().toUpperCase();
    if (!cleanId) {
      setErrorMessage('Please enter a Certificate ID.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await certificateService.verifyCertificate(cleanId, eventIdToVerify || undefined);
      setResult(res);
    } catch (err) {
      setResult({
        state: 'NOT_FOUND',
        searchedId: cleanId,
        errorMessage: 'The certificate ID could not be verified.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEventId) {
      setErrorMessage('Please select an event.');
      return;
    }

    if (!certificateId.trim()) {
      setErrorMessage('Please enter a Certificate ID.');
      return;
    }

    if (onVerifySubmit) {
      onVerifySubmit(certificateId, selectedEventId);
    } else {
      performVerification(certificateId, selectedEventId);
    }
  };

  const handleReset = () => {
    setResult(null);
    setCertificateId('');
    setErrorMessage(null);
    if (onResetToHome) {
      onResetToHome();
    }
  };

  return (
    <div className="verify-container">
      {result ? (
        <VerificationResult result={result} onReset={handleReset} />
      ) : (
        <div className="verify-card screen-only">
          <div className="verify-header">
            <h1 className="verify-title">Certificate Verification</h1>
            <p className="verify-subtitle">Verify an IKSC certificate using its Certificate ID.</p>
          </div>

          <form className="verify-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="event-select" className="form-label">Select Event</label>
              <select
                id="event-select"
                className="form-select"
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
              >
                <option value="">Select Event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="cert-id-input" className="form-label">Certificate ID</label>
              <input
                id="cert-id-input"
                type="text"
                className="form-input"
                placeholder="Enter Certificate ID"
                value={certificateId}
                onChange={(e) => {
                  setCertificateId(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>

            {errorMessage && (
              <div className="form-error">{errorMessage}</div>
            )}

            <button type="submit" className="btn-verify" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
