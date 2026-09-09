import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import JSZip from 'jszip';
import { CertificateRecord } from '../src/types/certificate';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'https://iksc-certificate-verification.vercel.app';
const CERTS_PATH = path.join(__dirname, '..', 'src', 'data', 'certificates', 'ebtc-2026.json');
const OUTPUT_ZIP_PATH = path.join(__dirname, '..', 'IKSC-EBTC-2026-QR-Codes.zip');
const OUTPUT_DESKTOP_ZIP = path.join('C:', 'Users', 'gujja', 'OneDrive', 'Desktop', 'IKSC-EBTC-2026-QR-Codes.zip');
const QR_OUTPUT_DIR = path.join(__dirname, '..', 'qr-codes', 'IKSC-EBTC-2026');

async function decodeQrPng(buffer: Buffer): Promise<string | null> {
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code ? code.data : null;
}

async function main() {
  console.log('===========================================================');
  console.log('FINAL PRODUCTION QR GENERATION & DECODING VERIFICATION');
  console.log('Event: Engineering Beyond the Classroom (EBTC-2026)');
  console.log('Target Domain:', BASE_URL);
  console.log('===========================================================\n');

  if (!fs.existsSync(CERTS_PATH)) {
    console.error(`Certificate data file not found at: ${CERTS_PATH}`);
    process.exit(1);
  }

  const certs: CertificateRecord[] = JSON.parse(fs.readFileSync(CERTS_PATH, 'utf-8'));
  console.log(`Loaded ${certs.length} certificates from ${CERTS_PATH}`);

  if (certs.length !== 111) {
    console.error(`ERROR: Expected exactly 111 certificates, found ${certs.length}`);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(QR_OUTPUT_DIR)) {
    fs.mkdirSync(QR_OUTPUT_DIR, { recursive: true });
  }

  const zip = new JSZip();
  let totalGenerated = 0;
  let successfullyDecoded = 0;
  let failed = 0;
  const mismatches: { id: string; expected: string; actual: string | null }[] = [];

  console.log('\n--- Step 1: Generating & Programmatically Verifying Each QR Code ---');

  for (let i = 0; i < certs.length; i++) {
    const cert = certs[i];
    const expectedPad = String(i + 1).padStart(4, '0');
    const expectedId = `IKSC-EBTC-2026-${expectedPad}`;

    if (cert.id !== expectedId) {
      console.error(`[ERROR] ID sequence mismatch at index ${i}: expected ${expectedId}, got ${cert.id}`);
      process.exit(1);
    }

    const expectedPayload = `${BASE_URL}/verify?id=${encodeURIComponent(cert.id)}`;

    // Generate high-resolution 600x600 QR PNG buffer
    const qrBuffer = await QRCode.toBuffer(expectedPayload, {
      width: 600,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });

    totalGenerated++;

    // Step 2: Programmatically decode QR PNG image
    const decodedPayload = await decodeQrPng(qrBuffer);

    // Validate payload strictly
    const isExactMatch = decodedPayload === expectedPayload;
    const containsBadData = 
      !decodedPayload ||
      decodedPayload.includes('localhost') ||
      decodedPayload.includes('script.google.com') ||
      decodedPayload.includes(cert.participantName) ||
      decodedPayload.includes(cert.registrationNumber) ||
      decodedPayload.includes('{') ||
      decodedPayload.includes('}');

    if (isExactMatch && !containsBadData) {
      successfullyDecoded++;
      
      // Save individual PNG file to qr-codes directory
      const pngFilename = `${cert.id}.png`;
      fs.writeFileSync(path.join(QR_OUTPUT_DIR, pngFilename), qrBuffer);

      // Add to ZIP archive
      zip.file(pngFilename, qrBuffer);

      if ((i + 1) % 15 === 0 || i === certs.length - 1) {
        console.log(`Verified [${String(i + 1).padStart(3, ' ')}/111]: ${cert.id} -> ${decodedPayload}`);
      }
    } else {
      failed++;
      mismatches.push({
        id: cert.id,
        expected: expectedPayload,
        actual: decodedPayload
      });
      console.error(`[FAIL] Verification mismatch for ${cert.id}:`);
      console.error(`  Expected: ${expectedPayload}`);
      console.error(`  Decoded:  ${decodedPayload}`);
    }
  }

  console.log('\n===========================================================');
  console.log('DECODING & VERIFICATION SUMMARY:');
  console.log(`- Total generated:       ${totalGenerated}`);
  console.log(`- Successfully decoded:  ${successfullyDecoded}`);
  console.log(`- Failed:                ${failed}`);
  console.log(`- Mismatches:            ${mismatches.length}`);
  console.log('===========================================================');

  if (failed > 0 || mismatches.length > 0 || successfullyDecoded !== 111) {
    console.error('\nCRITICAL: One or more QR codes failed verification. Aborting ZIP generation.');
    process.exit(1);
  }

  console.log('\n--- Step 2: Packaging Verified QR Codes into Event-Specific ZIP ---');
  const zipBuffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });

  fs.writeFileSync(OUTPUT_ZIP_PATH, zipBuffer);
  console.log(`Created ZIP in workspace: ${OUTPUT_ZIP_PATH} (${(zipBuffer.length / 1024).toFixed(1)} KB)`);

  // Also place copy on Desktop for convenient admin access
  try {
    fs.writeFileSync(OUTPUT_DESKTOP_ZIP, zipBuffer);
    console.log(`Created ZIP on Desktop:   ${OUTPUT_DESKTOP_ZIP}`);
  } catch (err: any) {
    console.warn(`Could not save copy to Desktop (${err.message}), workspace ZIP is available.`);
  }

  // Also copy to public directory so admin can download it directly from the site if needed
  const publicZip = path.join(__dirname, '..', 'public', 'IKSC-EBTC-2026-QR-Codes.zip');
  fs.writeFileSync(publicZip, zipBuffer);
  console.log(`Copied ZIP to public dir: ${publicZip}`);

  console.log('\n>>> ALL 111 QR CODES GENERATED, DECODED, VERIFIED, AND PACKAGED! <<<');
}

main().catch(err => {
  console.error('Fatal error in QR generation:', err);
  process.exit(1);
});
