import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');

console.log('=== IKSC Certificate Verification Portal Pre-Deployment Verification ===\n');

// 1. Test Clean Baseline: 0 fake/test events
const eventsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf-8'));
if (Array.isArray(eventsRaw) && eventsRaw.length === 0) {
  console.log('[PASS] Events Registry: Completely clean (0 fake/test events).');
} else {
  console.error(`[FAIL] Expected 0 pre-loaded events in events.json, found ${eventsRaw.length}`);
  process.exit(1);
}

// 2. Test Real EBTC Participant Master Data Available for Import
const ebtcRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'certificates', 'ebtc-2026.json'), 'utf-8'));
if (ebtcRaw.length === 111) {
  console.log(`[PASS] EBTC Master Certificate Roster count: EXACTLY ${ebtcRaw.length} certificates ready for import.`);
} else {
  console.error(`[FAIL] Expected 111 EBTC certificates in roster file, got ${ebtcRaw.length}`);
  process.exit(1);
}

// 3. Test Benchmark Certificate: IKSC-EBTC-2026-0001
const cert0001 = ebtcRaw.find(c => c.id === 'IKSC-EBTC-2026-0001');
if (!cert0001) {
  console.error('[FAIL] Certificate IKSC-EBTC-2026-0001 not found in master roster!');
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
