import JSZip from 'jszip';
import QRCode from 'qrcode';
import { CertificateRecord, EventInfo } from '../types/certificate';

import { getProductionBaseUrl } from './urlConfig';

export class QrZipService {
  /**
   * Generates high-resolution QR PNG files for an event and bundles them into a ZIP
   */
  public async downloadEventQrZip(
    event: EventInfo,
    certificates: CertificateRecord[],
    onProgress?: (current: number, total: number) => void
  ): Promise<void> {
    // Crucial safety check: Strictly isolate to this event only
    const eventCerts = certificates.filter(
      c => c.eventId.toLowerCase() === event.id.toLowerCase()
    );

    if (eventCerts.length === 0) {
      throw new Error(`No certificates found for event ${event.name} (${event.id}).`);
    }

    const zip = new JSZip();
    const origin = getProductionBaseUrl();

    for (let i = 0; i < eventCerts.length; i++) {
      const cert = eventCerts[i];
      const verificationUrl = `${origin}/verify?id=${encodeURIComponent(cert.id)}`;

      // Generate high-resolution PNG (600x600 px) for crisp print/merch stamping
      const dataUrl = await QRCode.toDataURL(verificationUrl, {
        width: 600,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      });

      // Strip base64 metadata to obtain pure binary
      const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
      zip.file(`${cert.id}.png`, base64Data, { base64: true });

      if (onProgress) {
        onProgress(i + 1, eventCerts.length);
      }
    }

    // Generate ZIP blob
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    // Download in browser with exact naming standard
    const zipFilename = `IKSC-${event.code}-${event.year}-QR-Codes.zip`;
    const downloadUrl = URL.createObjectURL(zipBlob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  }
}

export const qrZipService = new QrZipService();
