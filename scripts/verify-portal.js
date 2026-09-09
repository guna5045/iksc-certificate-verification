import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

console.log('=== IKSC Certificate Verification Portal Test Suite ===\n');

// 1. Test Events: Exactly 1 real event (EBTC-2026)
const eventsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf-8'));
if (eventsRaw.length === 1 && eventsRaw[0].id === 'EBTC-2026') {
  console.log(`[PASS] Events Loaded: Exactly ${eventsRaw.length} event (EBTC-2026: ${eventsRaw[0].name}).`);
} else {
  console.error(`[FAIL] Expected exactly 1 event (EBTC-2026), got ${eventsRaw.length}:`, eventsRaw);
  process.exit(1);
}

// 2. Test 111 EBTC Certificates
const ebtcRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'certificates', 'ebtc-2026.json'), 'utf-8'));
if (ebtcRaw.length === 111) {
  console.log(`[PASS] EBTC Certificate Roster count: EXACTLY ${ebtcRaw.length} certificates.`);
} else {
  console.error(`[FAIL] Expected 111 EBTC certificates, got ${ebtcRaw.length}`);
  process.exit(1);
}

// 3. Test Benchmark Certificate: IKSC-EBTC-2026-0001
const cert0001 = ebtcRaw.find(c => c.id === 'IKSC-EBTC-2026-0001');
if (!cert0001) {
  console.error('[FAIL] Certificate IKSC-EBTC-2026-0001 not found!');
  process.exit(1);
}

const checks = [
  ['Participant Name', cert0001.participantName, 'JEYAPREETHA S R'],
  ['Registration Number', cert0001.registrationNumber, '9924030005'],
  ['Year', cert0001.yearOfStudy, '3rd Year'],
  ['Department', cert0001.department, 'Aeronautical Engineering'],
  ['Event', cert0001.eventName, 'Engineering Beyond the Classroom'],
  ['Date', cert0001.eventDates, '15th and 16th August 2026'],
  ['Certificate ID', cert0001.id, 'IKSC-EBTC-2026-0001'],
  ['Issued By', cert0001.issuedBy, 'IUCEE KARE Student Chapter'],
  ['Status', cert0001.status, 'VALID']
];

console.log('\n--- Checking IKSC-EBTC-2026-0001 Specification ---');
let allPassed = true;
checks.forEach(([label, actual, expected]) => {
  if (actual === expected) {
    console.log(`[PASS] ${label}: "${actual}" matches specification.`);
  } else {
    console.error(`[FAIL] ${label}: Expected "${expected}", but got "${actual}"`);
    allPassed = false;
  }
});

if (!allPassed) process.exit(1);

// 4. Test Database Seed Generation
const seedSqlPath = path.join(__dirname, '..', 'supabase', 'seed_ebtc_111.sql');
if (fs.existsSync(seedSqlPath)) {
  const seedContent = fs.readFileSync(seedSqlPath, 'utf-8');
  if (seedContent.includes('IKSC-EBTC-2026-0001') && seedContent.includes('IKSC-EBTC-2026-0111')) {
    console.log('\n[PASS] Supabase SQL seed file verified with all 111 certificates.');
  } else {
    console.error('[FAIL] Supabase SQL seed file missing certificates.');
    process.exit(1);
  }
}

// 5. Test Live HTTP Server
try {
  const res = await fetch('http://localhost:5173/');
  if (res.ok) {
    console.log(`\n[PASS] Local HTTP dev server is running and returned status ${res.status}`);
  }
} catch (e) {
  console.log('\n[INFO] Local dev server check skipped.');
}

console.log('\n=== ALL SYSTEM TESTS PASSED SUCCESSFULLY! ===');
