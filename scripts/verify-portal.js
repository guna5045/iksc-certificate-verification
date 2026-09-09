import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

console.log('=== IKSC Certificate Verification Portal Pre-Deployment Verification ===\n');

// 1. Test Production Events: Exactly 1 real event EBTC-2026 (0 fake/test events)
const eventsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf-8'));
if (Array.isArray(eventsRaw) && eventsRaw.length === 1 && eventsRaw[0].id === 'EBTC-2026') {
  console.log('[PASS] Events Registry: Verified 1 real production event (EBTC-2026 - Engineering Beyond the Classroom, 0 fake events).');
} else {
  console.error(`[FAIL] Expected 1 real event (EBTC-2026) in events.json, found ${eventsRaw.length}`);
  process.exit(1);
}

// 2. Test Real EBTC Participant Master Data: Exactly 111 certificates
const ebtcRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'certificates', 'ebtc-2026.json'), 'utf-8'));
if (ebtcRaw.length === 111) {
  console.log(`[PASS] EBTC Master Certificate Roster count: EXACTLY ${ebtcRaw.length} certificates.`);
} else {
  console.error(`[FAIL] Expected 111 EBTC certificates in roster file, got ${ebtcRaw.length}`);
  process.exit(1);
}

// 3. Test Benchmark Certificates
const benchmarkChecks = [
  {
    id: 'IKSC-EBTC-2026-0001',
    participantName: 'JEYAPREETHA S R',
    registrationNumber: '9924030005',
    yearOfStudy: '3rd Year',
    department: 'Aeronautical Engineering',
    status: 'VALID'
  },
  {
    id: 'IKSC-EBTC-2026-0002',
    participantName: 'SWETHA N',
    registrationNumber: '9924030002',
    yearOfStudy: '1st Year',
    department: 'Civil Engineering',
    status: 'VALID'
  },
  {
    id: 'IKSC-EBTC-2026-0008',
    participantName: 'DIVYA T',
    registrationNumber: '9924030008',
    yearOfStudy: '1st Year',
    department: 'Information Technology',
    status: 'VALID'
  },
  {
    id: 'IKSC-EBTC-2026-0088',
    participantName: 'DIVYA T',
    registrationNumber: '9924030088',
    yearOfStudy: '1st Year',
    department: 'Information Technology',
    status: 'VALID'
  },
  {
    id: 'IKSC-EBTC-2026-0111',
    participantName: 'ROHIT P',
    registrationNumber: '9924030111',
    yearOfStudy: '3rd Year',
    department: 'Artificial Intelligence & Data Science',
    status: 'VALID'
  }
];

console.log('\n--- Checking Benchmark Certificates ---');
for (const check of benchmarkChecks) {
  const cert = ebtcRaw.find(c => c.id === check.id);
  if (!cert) {
    console.error(`[FAIL] Certificate ${check.id} not found in master roster!`);
    process.exit(1);
  }
  if (
    cert.participantName === check.participantName &&
    cert.registrationNumber === check.registrationNumber &&
    cert.yearOfStudy === check.yearOfStudy &&
    cert.department === check.department &&
    cert.status === check.status
  ) {
    console.log(`[PASS] ${check.id}: "${cert.participantName}" (${cert.registrationNumber}) verified.`);
  } else {
    console.error(`[FAIL] ${check.id}: Details mismatch!`, cert);
    process.exit(1);
  }
}

// 4. Test Vercel SPA Routing Configuration
const vercelConfigPath = path.join(__dirname, '..', 'vercel.json');
if (fs.existsSync(vercelConfigPath)) {
  const vercelJson = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));
  if (vercelJson.rewrites && vercelJson.rewrites.length > 0) {
    console.log('\n[PASS] vercel.json SPA rewrite rules verified.');
  } else {
    console.error('[FAIL] vercel.json missing rewrites rule.');
    process.exit(1);
  }
} else {
  console.error('[FAIL] vercel.json not found!');
  process.exit(1);
}

console.log('\n=== ALL SYSTEM TESTS PASSED SUCCESSFULLY! ===');
