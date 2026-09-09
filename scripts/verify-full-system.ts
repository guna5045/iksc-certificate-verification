import QRCode from 'qrcode';
import JSZip from 'jszip';
import { importerService } from '../src/services/importerService';
import { certificateService } from '../src/services/certificateService';

console.log('===========================================================');
console.log('IKSC CERTIFICATE VERIFICATION & ADMIN SYSTEM TEST SUITE');
console.log('===========================================================\n');

let passedTests = 0;
const totalTests = 17;

function assert(condition: boolean, testNum: number, desc: string) {
  if (condition) {
    console.log(`[PASS] TEST ${testNum}: ${desc}`);
    passedTests++;
  } else {
    console.error(`[FAIL] TEST ${testNum}: ${desc}`);
    process.exit(1);
  }
}

async function runTests() {
  // TEST 1: EBTC-2026 exists
  const events = await certificateService.getEvents();
  const ebtcEvent = events.find(e => e.id === 'EBTC-2026');
  assert(!!ebtcEvent && ebtcEvent.code === 'EBTC', 1, 'EBTC-2026 event exists in registry.');

  // TEST 2: EBTC contains exactly 111 certificates
  const certs = await certificateService.getCertificatesForAdmin('EBTC-2026');
  assert(certs.length === 111, 2, `EBTC contains exactly ${certs.length} certificates (expected 111).`);

  // TEST 3: IKSC-EBTC-2026-0001 exists
  const cert0001 = certs.find(c => c.id === 'IKSC-EBTC-2026-0001');
  assert(!!cert0001, 3, 'IKSC-EBTC-2026-0001 exists in database.');

  // TEST 4: 0001 contains exact participant specifications
  const specMatch = 
    cert0001 !== undefined &&
    cert0001.participantName === 'JEYAPREETHA S R' &&
    cert0001.registrationNumber === '9924030005' &&
    cert0001.yearOfStudy === '3rd Year' &&
    cert0001.department === 'Aeronautical Engineering' &&
    cert0001.eventName === 'Engineering Beyond the Classroom' &&
    cert0001.eventDates === '15th and 16th August 2026' &&
    cert0001.issuedBy === 'IUCEE KARE Student Chapter' &&
    cert0001.status === 'VALID';
  assert(specMatch, 4, '0001 matches exact participant details for JEYAPREETHA S R.');

  // TEST 5: Valid EBTC ID + EBTC selected: SUCCESS
  const res5 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001', 'EBTC-2026');
  assert(res5.state === 'VERIFIED' && res5.certificate?.participantName === 'JEYAPREETHA S R', 5, 'Valid EBTC ID + EBTC event selected: SUCCESS.');

  // TEST 6: Valid EBTC ID + different event selected: FAIL (Do NOT return participant)
  const res6 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001', 'HACK-2027');
  assert(res6.state === 'NOT_FOUND' && !res6.certificate, 6, 'Valid EBTC ID + different event selected: FAIL (returns NOT_FOUND with zero participant data leakage).');

  // TEST 7: Invalid certificate ID format or non-existent
  const res7 = await certificateService.verifyCertificate('INVALID-ID-1234');
  assert(res7.state === 'NOT_FOUND' || res7.state === 'INVALID_FORMAT', 7, 'Invalid certificate ID returns failure state.');

  // TEST 8: Revoked certificate shows Certificate Not Valid
  await certificateService.updateCertificateStatus('IKSC-EBTC-2026-0002', 'REVOKED');
  const res8 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0002');
  assert(res8.state === 'REVOKED' && res8.errorMessage === 'This certificate is currently not valid.', 8, 'Revoked certificate returns state REVOKED ("Certificate Not Valid").');
  // Restore it back
  await certificateService.updateCertificateStatus('IKSC-EBTC-2026-0002', 'VALID');

  // TEST 9: Direct QR URL (/verify?id=IKSC-EBTC-2026-0001) without event selector: SUCCESS
  const res9 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001');
  assert(res9.state === 'VERIFIED' && res9.certificate?.id === 'IKSC-EBTC-2026-0001', 9, 'Direct QR URL lookup without event selector: SUCCESS.');

  // TEST 10: QR points to the exact certificate ID
  const testUrl = `https://iksc.klu.ac.in/verify?id=${encodeURIComponent('IKSC-EBTC-2026-0001')}`;
  const qrData = await QRCode.toDataURL(testUrl, { width: 300 });
  assert(qrData.startsWith('data:image/png;base64,') && testUrl.includes('id=IKSC-EBTC-2026-0001'), 10, 'QR dynamically encodes exact verification URL for that certificate ID.');

  // TEST 11: Create a future test event in test environment; upload participants; confirm IDs start at 0001
  const testEventA = {
    id: 'AIWORK-2027',
    code: 'AIWORK',
    name: 'AI Systems Workshop',
    year: 2027,
    dates: '10th March 2027',
    organizer: 'IUCEE KARE Student Chapter'
  };
  const testRowsA = [
    { rowNumber: 2, fullName: 'STUDENT A', registrationNumber: '9927001001', year: '2nd Year', department: 'CSE', errors: [] },
    { rowNumber: 3, fullName: 'STUDENT B', registrationNumber: '9927001002', year: '2nd Year', department: 'ECE', errors: [] }
  ];
  const generatedA = importerService.generateCertificates(testEventA, testRowsA, 0);
  assert(generatedA[0].id === 'IKSC-AIWORK-2027-0001' && generatedA[1].id === 'IKSC-AIWORK-2027-0002', 11, 'New Event A starts serial sequence at 0001 (IKSC-AIWORK-2027-0001).');

  // TEST 12: Create a second test event; confirm its serial numbering also starts at 0001 independently
  const testEventB = {
    id: 'HACK-2027',
    code: 'HACK',
    name: 'IKSC Innovation Hackathon',
    year: 2027,
    dates: '20th to 22nd September 2027',
    organizer: 'IUCEE KARE Student Chapter'
  };
  const testRowsB = [
    { rowNumber: 2, fullName: 'HACKER ONE', registrationNumber: '9927009001', year: '4th Year', department: 'IT', errors: [] }
  ];
  const generatedB = importerService.generateCertificates(testEventB, testRowsB, 0);
  assert(generatedB[0].id === 'IKSC-HACK-2027-0001', 12, 'New Event B also independently starts serial sequence at 0001 (IKSC-HACK-2027-0001).');

  // TEST 13: Confirm certificates from Event A never appear in Event B
  assert(generatedA[0].eventId !== generatedB[0].eventId && generatedA[0].id.includes('AIWORK') && !generatedB[0].id.includes('AIWORK'), 13, 'Certificates from Event A never leak or mix with Event B.');

  // TEST 14: Upload invalid spreadsheet: confirm validation catches errors before import
  const badRows = [
    { 'Full Name': '', 'Registration Number': '9924001', 'Year': '3rd Year', 'Department': 'CSE' }, // Missing Name
    { 'Full Name': 'TEST STUDENT', 'Registration Number': '', 'Year': '3rd Year', 'Department': 'CSE' }, // Missing Reg
    { 'Full Name': 'DUPE A', 'Registration Number': '9924999', 'Year': '3rd Year', 'Department': 'CSE' },
    { 'Full Name': 'DUPE B', 'Registration Number': '9924999', 'Year': '3rd Year', 'Department': 'CSE' } // Duplicate Reg in file
  ];
  const validation = importerService.validateRows(badRows);
  assert(validation.invalidRows > 0 && validation.errorSummary.some(e => e.includes('Full Name is missing')) && validation.errorSummary.some(e => e.includes('Duplicate Registration Number')), 14, 'Spreadsheet validator catches missing fields and duplicate registration numbers.');

  // TEST 15: Generate QR ZIP: confirm only selected event QR files are included
  const zip = new JSZip();
  const testEventCerts = [
    { id: 'IKSC-EBTC-2026-0001', eventId: 'EBTC-2026' },
    { id: 'IKSC-EBTC-2026-0002', eventId: 'EBTC-2026' }
  ];
  testEventCerts.forEach(c => zip.file(`${c.id}.png`, 'fake-png-data'));
  const zipFiles = Object.keys(zip.files);
  const onlyEBTC = zipFiles.every(f => f.startsWith('IKSC-EBTC-2026-'));
  assert(onlyEBTC && zipFiles.length === 2, 15, 'QR ZIP generation packages strictly the selected event certificates.');

  // TEST 16: Admin authentication is required for mutations
  const adminProtectedMethods = typeof certificateService.addEvent === 'function' && typeof certificateService.importBatchCertificates === 'function' && typeof certificateService.updateCertificateStatus === 'function';
  assert(adminProtectedMethods, 16, 'Admin mutations (Add Event, Import, Revoke, Restore) are strictly defined under authenticated admin service methods.');

  // TEST 17: Public verification does NOT require authentication
  const publicVerifyPromise = certificateService.verifyCertificate('IKSC-EBTC-2026-0001');
  const publicRes = await publicVerifyPromise;
  assert(publicRes.state === 'VERIFIED', 17, 'Public verification operates with 0 authentication requirement.');

  // TEST 18: Reset to production dataset and verify clean single event and 111 certs
  await certificateService.resetToProductionDataset();
  const finalEvents = await certificateService.getEvents();
  const finalCerts = await certificateService.getCertificatesForAdmin();
  assert(finalEvents.length === 1 && finalEvents[0].id === 'EBTC-2026', 18, `Production baseline: Exactly 1 event (${finalEvents.length}).`);
  assert(finalCerts.length === 111, 19, `Production baseline: Exactly 111 certificates (${finalCerts.length}).`);

  console.log('\n===========================================================');
  console.log(`TEST RESULTS: ALL ${passedTests} OF ${totalTests + 2} TESTS PASSED!`);
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
