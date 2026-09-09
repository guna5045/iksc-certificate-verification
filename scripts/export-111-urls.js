import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certsPath = path.join(__dirname, '..', 'src', 'data', 'certificates', 'ebtc-2026.json');
const certs = JSON.parse(fs.readFileSync(certsPath, 'utf-8'));

// Base domain placeholder (can be updated to custom domain e.g. https://verify.iksc.in)
const domain = process.env.VITE_PUBLIC_DOMAIN || 'https://iksc-certificate-verification.vercel.app';

const csvHeader = 'CertificateID,ParticipantName,RegistrationNumber,Department,Year,VerificationURL\n';
const csvRows = certs.map(c => {
  const url = `${domain}/verify?id=${encodeURIComponent(c.id)}`;
  return `"${c.id}","${c.participantName}","${c.registrationNumber}","${c.department}","${c.yearOfStudy}","${url}"`;
});

const outPath = path.join(__dirname, '..', 'ebtc-111-verification-urls.csv');
fs.writeFileSync(outPath, csvHeader + csvRows.join('\n'));
console.log(`Exported all ${certs.length} certificate verification URLs to ${outPath}`);
