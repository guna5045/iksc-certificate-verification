import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const CERTS_DIR = path.join(DATA_DIR, 'certificates');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CERTS_DIR)) fs.mkdirSync(CERTS_DIR, { recursive: true });

// Only real event
const events = [
  {
    id: 'EBTC-2026',
    code: 'EBTC',
    name: 'Engineering Beyond the Classroom',
    year: 2026,
    dates: '15th and 16th August 2026',
    organizer: 'IUCEE KARE Student Chapter',
    description: 'Signature symposium and colloquium organized by IUCEE KARE Student Chapter.',
    category: 'Symposium',
    location: 'Kalasalingam Academy of Research and Education (KARE)',
    totalIssued: 111
  }
];

// Department and student data for EBTC
const departments = [
  'Aeronautical Engineering',
  'Computer Science and Engineering',
  'Electronics and Communication Engineering',
  'Mechanical Engineering',
  'Artificial Intelligence & Data Science',
  'Information Technology',
  'Biotechnology',
  'Civil Engineering',
  'Electrical and Electronics Engineering',
  'Biomedical Engineering'
];

const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

const firstNames = [
  'JEYAPREETHA', 'ARAVIND', 'KAVITHA', 'SARAVANAN', 'DEEPIKA', 'VISHNU', 'SNEHA', 'KARTHIK', 'PRIYA', 'DINESH',
  'ANANYA', 'HARISH', 'MEGHA', 'PRANAV', 'SWETHA', 'MANOJ', 'DIVYA', 'ROHIT', 'NITHYA', 'SANJAY',
  'AISHWARYA', 'GOKUL', 'KEERTHANA', 'VIGNESH', 'PAVITHRA', 'ASWIN', 'SHRUTI', 'NAVEEN', 'POOJA', 'PRAVEEN',
  'VARSHA', 'KISHORE', 'MADHUMITHA', 'VIJAY', 'MONIKA', 'RAGHUL', 'HARINI', 'AJAY', 'ABINAYA', 'SURYA'
];

const lastNames = ['S R', 'K', 'M', 'P', 'R', 'V', 'N', 'S', 'B', 'T', 'G', 'L', 'A', 'D', 'C'];

const ebtcCertificates = [];

// Certificate #0001 is explicitly JEYAPREETHA S R
ebtcCertificates.push({
  id: 'IKSC-EBTC-2026-0001',
  eventId: 'EBTC-2026',
  participantName: 'JEYAPREETHA S R',
  registrationNumber: '9924030005',
  yearOfStudy: '3rd Year',
  department: 'Aeronautical Engineering',
  eventName: 'Engineering Beyond the Classroom',
  eventDates: '15th and 16th August 2026',
  issuedBy: 'IUCEE KARE Student Chapter',
  certificateType: 'Participation',
  issueDate: '16th August 2026',
  status: 'VALID'
});

// Generate 0002 through 0111
for (let i = 2; i <= 111; i++) {
  const padIndex = String(i).padStart(4, '0');
  const regNo = String(9924030000 + i);
  const fn = firstNames[(i * 7) % firstNames.length];
  const ln = lastNames[(i * 3) % lastNames.length];
  const dept = departments[(i * 3 + 1) % departments.length];
  const yr = years[(i * 2) % years.length];

  ebtcCertificates.push({
    id: `IKSC-EBTC-2026-${padIndex}`,
    eventId: 'EBTC-2026',
    participantName: `${fn} ${ln}`,
    registrationNumber: regNo,
    yearOfStudy: yr,
    department: dept,
    eventName: 'Engineering Beyond the Classroom',
    eventDates: '15th and 16th August 2026',
    issuedBy: 'IUCEE KARE Student Chapter',
    certificateType: 'Participation',
    issueDate: '16th August 2026',
    status: 'VALID'
  });
}

// Write events and certificates
fs.writeFileSync(path.join(DATA_DIR, 'events.json'), JSON.stringify(events, null, 2));
fs.writeFileSync(path.join(CERTS_DIR, 'ebtc-2026.json'), JSON.stringify(ebtcCertificates, null, 2));

console.log(`Generated ${events.length} real event (EBTC-2026).`);
console.log(`Generated ${ebtcCertificates.length} certificates for EBTC-2026 (IKSC-EBTC-2026-0001 to 0111).`);
