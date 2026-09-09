import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { VerificationResult as IVerificationResult } from '../types/certificate';
import { getProductionBaseUrl } from '../services/urlConfig';

interface VerificationResultProps {
  result: IVerificationResult;
  onReset: () => void;
}

export const VerificationResult: React.FC<VerificationResultProps> = ({ result, onReset }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const cert = result.certificate;

  // Build the official verification URL for QR encoding (NOT displayed as visible text)
  const verificationUrl = cert
    ? `${getProductionBaseUrl()}/verify?id=${encodeURIComponent(cert.id)}`
    : '';

  // Dynamically generate high-resolution QR code encoding the verification URL
  useEffect(() => {
    if (verificationUrl) {
      QRCode.toDataURL(verificationUrl, {
        width: 380,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('QR generation error:', err));
    }
  }, [verificationUrl]);

  const handlePrint = () => {
    window.print();
  };

  // 1. Verified Valid State
  if (result.state === 'VERIFIED' && cert) {
    return (
      <>
        {/* On-Screen Result Presentation */}
        <div className="result-card screen-only">
          <div className="result-header verified">
            <CheckCircle size={22} />
            <span className="result-status-title">Certificate Verified</span>
          </div>

          <div className="result-body">
            <div className="details-grid">
              <div className="detail-row">
                <span className="detail-label">Participant Name</span>
                <span className="detail-value participant-name">{cert.participantName}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Registration Number</span>
                <span className="detail-value reg-num">{cert.registrationNumber}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Year</span>
                <span className="detail-value">{cert.yearOfStudy}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Department</span>
                <span className="detail-value">{cert.department}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Event</span>
                <span className="detail-value">{cert.eventName}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Date</span>
                <span className="detail-value">{cert.eventDates}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Certificate ID</span>
                <span className="detail-value cert-id">{cert.id}</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Issued By</span>
                <span className="detail-value">IUCEE KARE Student Chapter</span>
              </div>
            </div>

            {/* QR Code Section (Internal Verification QR - No visible raw URL) */}
            <div className="qr-section">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt={`QR Code for Certificate ${cert.id}`} 
                  className="qr-image"
                />
              ) : (
                <div className="qr-placeholder">Generating QR...</div>
              )}
            </div>
          </div>

          <div className="result-actions">
            <button type="button" className="btn-secondary" onClick={onReset}>
              Verify Another Certificate
            </button>
            <button type="button" className="btn-secondary btn-print" onClick={handlePrint}>
              Print Verification
            </button>
          </div>
        </div>

        {/* Dedicated Professional Print/PDF Layout */}
        <div className="print-document">
          {/* Official Header */}
          <div className="print-header">
            <img 
              src="./StuChapLogo.png" 
              alt="IKSC Logo" 
              className="print-logo" 
            />
            <div className="print-brand-text">
              <h1 className="print-org-title">IKSC</h1>
              <h2 className="print-org-sub">IUCEE KARE Student Chapter</h2>
            </div>
          </div>

          <div className="print-doc-title">
            <span>CERTIFICATE VERIFICATION</span>
          </div>

          {/* Verification Badge */}
          <div className="print-status-banner">
            <span className="print-status-text">Certificate Verified</span>
          </div>

          {/* Information Table / Grid */}
          <table className="print-details-table">
            <tbody>
              <tr>
                <td className="print-label">Participant Name</td>
                <td className="print-value print-name">{cert.participantName}</td>
              </tr>
              <tr>
                <td className="print-label">Registration Number</td>
                <td className="print-value font-mono">{cert.registrationNumber}</td>
              </tr>
              <tr>
                <td className="print-label">Year</td>
                <td className="print-value">{cert.yearOfStudy}</td>
              </tr>
              <tr>
                <td className="print-label">Department</td>
                <td className="print-value">{cert.department}</td>
              </tr>
              <tr>
                <td className="print-label">Event</td>
                <td className="print-value">{cert.eventName}</td>
              </tr>
              <tr>
                <td className="print-label">Date</td>
                <td className="print-value">{cert.eventDates}</td>
              </tr>
              <tr>
                <td className="print-label">Certificate ID</td>
                <td className="print-value font-mono print-cert-id">{cert.id}</td>
              </tr>
              <tr>
                <td className="print-label">Issued By</td>
                <td className="print-value">IUCEE KARE Student Chapter</td>
              </tr>
            </tbody>
          </table>

          {/* Print QR Code Section (Strictly QR Code Only - No visible raw URL) */}
          <div className="print-qr-container">
            {qrDataUrl && (
              <img 
                src={qrDataUrl} 
                alt={`Verification QR for ${cert.id}`} 
                className="print-qr-image" 
              />
            )}
          </div>

          {/* Print Document Footer */}
          <div className="print-footer">
            <span>Official Credential Verification Record • Kalasalingam Academy of Research and Education</span>
          </div>
        </div>
      </>
    );
  }

  // 2. Revoked / Not Valid State
  if (result.state === 'REVOKED') {
    return (
      <div className="result-card screen-only">
        <div className="result-header revoked">
          <AlertCircle size={22} />
          <span className="result-status-title">Certificate Not Valid</span>
        </div>
        <div className="error-body">
          <p className="error-text">This certificate is currently not valid.</p>
          <button type="button" className="btn-secondary" onClick={onReset}>
            Verify Another Certificate
          </button>
        </div>
      </div>
    );
  }

  // 3. Not Found / Invalid State
  return (
    <div className="result-card screen-only">
      <div className="result-header not-found">
        <XCircle size={22} />
        <span className="result-status-title">Certificate Not Found</span>
      </div>
      <div className="error-body">
        <p className="error-text">
          {result.errorMessage || 'The certificate ID could not be verified.'}
        </p>
        <button type="button" className="btn-secondary" onClick={onReset}>
          Try Again
        </button>
      </div>
    </div>
  );
};
