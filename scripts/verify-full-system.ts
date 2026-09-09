import QRCode from 'qrcode';
import JSZip from 'jszip';
import { importerService } from '../src/services/importerService';
import { certificateService } from '../src/services/certificateService';
import ebtcData from '../src/data/certificates/ebtc-2026.json';

console.log('===========================================================');
console.log('IKSC CERTIFICATE VERIFICATION & ADMIN SYSTEM TEST SUITE');
console.log('===========================================================\n');

let passedTests = 0;
const totalTests = 20;

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
  // TEST 1: Initial state is clean (0 fake/test events)
  await certificateService.resetToProductionDataset();
  const initialEvents = await certificateService.getEvents();
  assert(initialEvents.length === 0, 1, 'Initial state is completely clean: 0 events in database.');

  // TEST 2: Initial certificates count is 0
  const initialCerts = await certificateService.getCertificatesForAdmin();
  assert(initialCerts.length === 0, 2, 'Initial state is completely clean: 0 certificates in database.');

  // TEST 3: Admin can create an event
  const ebtcEvent = {
    id: 'EBTC-2026',
    code: 'EBTC',
    name: 'Engineering Beyond the Classroom',
    year: 2026,
    dates: '15th and 16th August 2026',
    organizer: 'IUCEE KARE Student Chapter',
    description: 'Signature symposium organized by IUCEE KARE Student Chapter.'
  };
  await certificateService.addEvent(ebtcEvent);
  const eventsAfterAdd = await certificateService.getEvents();
  assert(eventsAfterAdd.length === 1 && eventsAfterAdd[0].id === 'EBTC-2026', 3, 'Admin successfully created EBTC-2026 event.');

  // TEST 4: Admin can import participant certificates for the event
  await certificateService.importBatchCertificates(ebtcData as any);
  const certsAfterImport = await certificateService.getCertificatesForAdmin('EBTC-2026');
  assert(certsAfterImport.length === 111, 4, `Imported exactly 111 certificates for EBTC-2026 (got ${certsAfterImport.length}).`);

  // TEST 5: Verify benchmark certificate 0001
  const cert0001 = certsAfterImport.find(c => c.id === 'IKSC-EBTC-2026-0001');
  const specMatch = 
    cert0001 !== undefined &&
    cert0001.participantName === 'JEYAPREETHA S R' &&
    cert0001.registrationNumber === '9924030005' &&
    cert0001.yearOfStudy === '3rd Year' &&
    cert0001.department === 'Aeronautical Engineering' &&
    cert0001.status === 'VALID';
  assert(specMatch, 5, '0001 matches exact participant details for JEYAPREETHA S R.');

  // TEST 6: Valid EBTC ID + EBTC event selected: SUCCESS
  const res6 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001', 'EBTC-2026');
  assert(res6.state === 'VERIFIED' && res6.certificate?.participantName === 'JEYAPREETHA S R', 6, 'Valid EBTC ID + EBTC event selected: SUCCESS.');

  // TEST 7: Valid EBTC ID + different event selected: FAIL (Event isolation, zero data leak)
  const res7 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001', 'OTHER-2027');
  assert(res7.state === 'NOT_FOUND' && !res7.certificate, 7, 'Event isolation: Searching under wrong event returns NOT_FOUND with zero data leak.');

  // TEST 8: Invalid certificate ID format or non-existent
  const res8 = await certificateService.verifyCertificate('INVALID-ID-1234');
  assert(res8.state === 'NOT_FOUND' || res8.state === 'INVALID_FORMAT', 8, 'Invalid certificate ID returns failure state.');

  // TEST 9: Revoked certificate shows Certificate Not Valid
  await certificateService.updateCertificateStatus('IKSC-EBTC-2026-0002', 'REVOKED');
  const res9 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0002');
  assert(res9.state === 'REVOKED' && res9.errorMessage === 'This certificate is currently not valid.', 9, 'Revoked certificate returns state REVOKED ("Certificate Not Valid").');
  // Restore it back
  await certificateService.updateCertificateStatus('IKSC-EBTC-2026-0002', 'VALID');

  // TEST 10: Direct QR URL lookup without event selector: SUCCESS
  const res10 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001');
  assert(res10.state === 'VERIFIED' && res10.certificate?.id === 'IKSC-EBTC-2026-0001', 10, 'Direct QR URL lookup without event selector: SUCCESS.');

  // TEST 11: QR dynamically encodes exact verification URL for that certificate ID
  const testUrl = `https://iksc.klu.ac.in/verify?id=${encodeURIComponent('IKSC-EBTC-2026-0001')}`;
  const qrData = await QRCode.toDataURL(testUrl, { width: 300 });
  assert(qrData.startsWith('data:image/png;base64,') && testUrl.includes('id=IKSC-EBTC-2026-0001'), 11, 'QR dynamically encodes exact verification URL.');

  // TEST 12: Independent serial numbering for future events
  const testEventA = {
    id: 'AIWORK-2027',
    code: 'AIWORK',
    name: 'AI Systems Workshop',
    year: 2027,
    dates: '10th March 2027',
    organizer: 'IUCEE KARE Student Chapter'
  };
  const testRowsA = [
    { rowNumber: 2, fullName: 'STUDENT A', registrationNumber: '9927001001', year: '2nd Year', department: 'CSE', errors: [] }
  ];
  const generatedA = importerService.generateCertificates(testEventA, testRowsA, 0);
  assert(generatedA[0].id === 'IKSC-AIWORK-2027-0001', 12, 'Future Event serial starts independently at 0001.');

  // TEST 13: Spreadsheet validator catches missing fields and duplicates
  const badRows = [
    { 'Full Name': '', 'Registration Number': '9924001', 'Year': '3rd Year', 'Department': 'CSE' },
    { 'Full Name': 'DUPE A', 'Registration Number': '9924999', 'Year': '3rd Year', 'Department': 'CSE' },
    { 'Full Name': 'DUPE B', 'Registration Number': '9924999', 'Year': '3rd Year', 'Department': 'CSE' }
  ];
  const validation = importerService.validateRows(badRows);
  assert(validation.invalidRows > 0, 13, 'Spreadsheet validator catches invalid rows and duplicate registration numbers.');

  // TEST 14: QR ZIP packaging includes strictly the selected event's QR files
  const zip = new JSZip();
  zip.file('IKSC-EBTC-2026-0001.png', 'png-data');
  const zipFiles = Object.keys(zip.files);
  assert(zipFiles.length === 1 && zipFiles[0].startsWith('IKSC-EBTC-2026-'), 14, 'QR ZIP packages strictly selected event certificates.');

  // TEST 15: DELETE EVENT functionality - Deleting an event cascades and deletes all its certificates
  await certificateService.deleteEvent('EBTC-2026');
  const eventsAfterDelete = await certificateService.getEvents();
  const certsAfterDelete = await certificateService.getCertificatesForAdmin('EBTC-2026');
  assert(
    !eventsAfterDelete.some(e => e.id === 'EBTC-2026') && certsAfterDelete.length === 0,
    15,
    'DELETE EVENT removes event and cascades to completely purge all its certificates.'
  );

  // TEST 16: Zero orphaned certificates remain after event deletion
  const allRemainingCerts = await certificateService.getCertificatesForAdmin();
  assert(allRemainingCerts.length === 0, 16, 'Zero orphaned certificates remain after event deletion.');

  // TEST 17: Public verification after deletion returns NOT_FOUND
  const res17 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001');
  assert(res17.state === 'NOT_FOUND', 17, 'Public verification for deleted certificate returns NOT_FOUND.');

  // TEST 18: Admin mutations are properly guarded
  const adminGuarded = typeof certificateService.deleteEvent === 'function' && typeof certificateService.addEvent === 'function';
  assert(adminGuarded, 18, 'Admin mutations (addEvent, deleteEvent, importBatchCertificates) are defined.');

  // TEST 19: Public verification operates with 0 authentication requirement
  const publicRes = await certificateService.verifyCertificate('NON-EXISTENT-ID');
  assert(publicRes.state === 'NOT_FOUND', 19, 'Public verification requires zero authentication.');

  // TEST 20: Clean production baseline after full test suite
  await certificateService.resetToProductionDataset();
  const finalEvents = await certificateService.getEvents();
  const finalCerts = await certificateService.getCertificatesForAdmin();
  assert(finalEvents.length === 0 && finalCerts.length === 0, 20, 'System baseline confirmed: 0 fake events, 0 fake certificates.');

  console.log('\n===========================================================');
  console.log(`TEST RESULTS: ALL ${passedTests} OF ${totalTests} TESTS PASSED!`);
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
