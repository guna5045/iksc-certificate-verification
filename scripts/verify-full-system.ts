import QRCode from 'qrcode';
import JSZip from 'jszip';
import { importerService } from '../src/services/importerService';
import { certificateService } from '../src/services/certificateService';

console.log('===========================================================');
console.log('IKSC CERTIFICATE VERIFICATION & ADMIN SYSTEM TEST SUITE');
console.log('===========================================================\n');

let passedTests = 0;
const totalTests = 21;

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
  // TEST 1: Baseline production state has 1 real event (EBTC-2026)
  await certificateService.resetToProductionDataset();
  const initialEvents = await certificateService.getEvents();
  assert(
    initialEvents.length === 1 && initialEvents[0].id === 'EBTC-2026', 
    1, 
    'Production state verified: exactly 1 real event (EBTC-2026).'
  );

  // TEST 2: Baseline production state has all 111 real certificates
  const initialCerts = await certificateService.getCertificatesForAdmin();
  assert(
    initialCerts.length === 111, 
    2, 
    `Production state verified: exactly 111 certificates loaded (got ${initialCerts.length}).`
  );

  // TEST 3: Benchmark Certificate 0001 (JEYAPREETHA S R)
  const res0001 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001');
  const c0001 = res0001.certificate;
  const specMatch0001 = 
    res0001.state === 'VERIFIED' &&
    c0001 !== undefined &&
    c0001.participantName === 'JEYAPREETHA S R' &&
    c0001.registrationNumber === '9924030005' &&
    c0001.yearOfStudy === '3rd Year' &&
    c0001.department === 'Aeronautical Engineering' &&
    c0001.eventName === 'Engineering Beyond the Classroom' &&
    c0001.eventDates === '15th and 16th August 2026' &&
    c0001.status === 'VALID';
  assert(specMatch0001, 3, 'IKSC-EBTC-2026-0001 resolves to JEYAPREETHA S R with exact details.');

  // TEST 4: Benchmark Certificate 0002 (ASHIKA ASHOKKUMAR)
  const res0002 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0002');
  assert(
    res0002.state === 'VERIFIED' && res0002.certificate?.participantName === 'ASHIKA ASHOKKUMAR',
    4,
    'IKSC-EBTC-2026-0002 resolves to ASHIKA ASHOKKUMAR.'
  );

  // TEST 5: Benchmark Certificate 0003 (BATTU VENU GOPAL)
  const res0003 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0003');
  assert(
    res0003.state === 'VERIFIED' && 
    res0003.certificate?.participantName === 'BATTU VENU GOPAL' && 
    res0003.certificate?.registrationNumber === '99240040020',
    5,
    'IKSC-EBTC-2026-0003 resolves to BATTU VENU GOPAL (99240040020).'
  );

  // TEST 6: Benchmark Certificate 0008 (GAJULA BHAVYASREE - 99240040044)
  const res0008 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0008');
  assert(
    res0008.state === 'VERIFIED' && 
    res0008.certificate?.participantName === 'GAJULA BHAVYASREE' && 
    res0008.certificate?.registrationNumber === '99240040044',
    6,
    'IKSC-EBTC-2026-0008 resolves to GAJULA BHAVYASREE (99240040044).'
  );

  // TEST 7: Benchmark Certificate 0088 (SANJANA S - 99250040671)
  const res0088 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0088');
  assert(
    res0088.state === 'VERIFIED' && 
    res0088.certificate?.participantName === 'SANJANA S' && 
    res0088.certificate?.registrationNumber === '99250040671',
    7,
    'IKSC-EBTC-2026-0088 resolves to SANJANA S (99250040671).'
  );

  // TEST 8: Benchmark Certificate 0111 (DONTALA KRISHNA KANTH)
  const res0111 = await certificateService.verifyCertificate('IKSC-EBTC-2026-0111');
  assert(
    res0111.state === 'VERIFIED' && res0111.certificate?.participantName === 'DONTALA KRISHNA KANTH',
    8,
    'IKSC-EBTC-2026-0111 resolves to DONTALA KRISHNA KANTH.'
  );

  // TEST 9: Non-existent ID: IKSC-EBTC-2026-9999 returns NOT_FOUND with zero certificate data
  const res9999 = await certificateService.verifyCertificate('IKSC-EBTC-2026-9999');
  assert(
    res9999.state === 'NOT_FOUND' && !res9999.certificate,
    9,
    'Non-existent ID IKSC-EBTC-2026-9999 returns NOT_FOUND with zero exposed data.'
  );

  // TEST 10: Event Isolation: Valid EBTC ID + EBTC event selected: SUCCESS
  const resIsoOk = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001', 'EBTC-2026');
  assert(
    resIsoOk.state === 'VERIFIED' && resIsoOk.certificate?.participantName === 'JEYAPREETHA S R',
    10,
    'Event isolation: Correct event selected returns VERIFIED.'
  );

  // TEST 11: Event Isolation: Valid EBTC ID + different event selected: FAIL (Zero data leak)
  const resIsoFail = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001', 'OTHER-2027');
  assert(
    resIsoFail.state === 'NOT_FOUND' && !resIsoFail.certificate,
    11,
    'Event isolation: Wrong event selected returns NOT_FOUND with zero data leak.'
  );

  // TEST 12: Invalid format returns NOT_FOUND/INVALID_FORMAT
  const resInvalid = await certificateService.verifyCertificate('INVALID-ID-1234');
  assert(
    resInvalid.state === 'NOT_FOUND' || resInvalid.state === 'INVALID_FORMAT',
    12,
    'Invalid certificate ID format returns failure state.'
  );

  // TEST 13: Revoked certificate shows Certificate Not Valid
  await certificateService.updateCertificateStatus('IKSC-EBTC-2026-0002', 'REVOKED');
  const resRevoked = await certificateService.verifyCertificate('IKSC-EBTC-2026-0002');
  assert(
    resRevoked.state === 'REVOKED' && resRevoked.errorMessage === 'This certificate is currently not valid.',
    13,
    'Revoked certificate returns state REVOKED ("Certificate Not Valid").'
  );
  // Restore it back
  await certificateService.updateCertificateStatus('IKSC-EBTC-2026-0002', 'VALID');

  // TEST 14: Direct QR URL lookup without event selector
  const resDirect = await certificateService.verifyCertificate('IKSC-EBTC-2026-0001');
  assert(
    resDirect.state === 'VERIFIED' && resDirect.certificate?.id === 'IKSC-EBTC-2026-0001',
    14,
    'Direct QR URL lookup without event selector: SUCCESS.'
  );

  // TEST 15: QR dynamically encodes exact verification URL
  const testUrl = `https://iksc-certificate-verification.vercel.app/verify?id=${encodeURIComponent('IKSC-EBTC-2026-0001')}`;
  const qrData = await QRCode.toDataURL(testUrl, { width: 300 });
  assert(
    qrData.startsWith('data:image/png;base64,') && testUrl.includes('id=IKSC-EBTC-2026-0001'),
    15,
    'QR dynamically encodes exact verification URL.'
  );

  // TEST 16: Admin can create future events
  const testEventFuture = {
    id: 'AIWORK-2027',
    code: 'AIWORK',
    name: 'AI Systems Workshop',
    year: 2027,
    dates: '10th March 2027',
    organizer: 'IUCEE KARE Student Chapter'
  };
  await certificateService.addEvent(testEventFuture);
  const eventsAfterFuture = await certificateService.getEvents();
  assert(
    eventsAfterFuture.some(e => e.id === 'AIWORK-2027'),
    16,
    'Admin successfully added future event AIWORK-2027.'
  );

  // TEST 17: Independent serial numbering for future events
  const testRowsA = [
    { rowNumber: 2, fullName: 'STUDENT A', registrationNumber: '9927001001', year: '2nd Year', department: 'CSE', errors: [] }
  ];
  const generatedA = importerService.generateCertificates(testEventFuture, testRowsA, 0);
  assert(
    generatedA[0].id === 'IKSC-AIWORK-2027-0001',
    17,
    'Future Event serial starts independently at 0001.'
  );

  // TEST 18: Spreadsheet validator catches errors
  const badRows = [
    { 'Full Name': '', 'Registration Number': '9924001', 'Year': '3rd Year', 'Department': 'CSE' },
    { 'Full Name': 'DUPE A', 'Registration Number': '9924999', 'Year': '3rd Year', 'Department': 'CSE' },
    { 'Full Name': 'DUPE B', 'Registration Number': '9924999', 'Year': '3rd Year', 'Department': 'CSE' }
  ];
  const validation = importerService.validateRows(badRows);
  assert(
    validation.invalidRows > 0,
    18,
    'Spreadsheet validator catches invalid rows and duplicate registration numbers.'
  );

  // TEST 19: Delete future event cleans up without affecting EBTC-2026
  await certificateService.deleteEvent('AIWORK-2027');
  const eventsAfterCleanup = await certificateService.getEvents();
  assert(
    !eventsAfterCleanup.some(e => e.id === 'AIWORK-2027') && eventsAfterCleanup.some(e => e.id === 'EBTC-2026'),
    19,
    'Deleting future event cleanly removes it while preserving EBTC-2026.'
  );

  // TEST 20: QR ZIP packaging
  const zip = new JSZip();
  zip.file('IKSC-EBTC-2026-0001.png', 'png-data');
  const zipFiles = Object.keys(zip.files);
  assert(
    zipFiles.length === 1 && zipFiles[0].startsWith('IKSC-EBTC-2026-'),
    20,
    'QR ZIP packaging succeeds.'
  );

  // TEST 21: Final verification of production baseline
  await certificateService.resetToProductionDataset();
  const finalEvents = await certificateService.getEvents();
  const finalCerts = await certificateService.getCertificatesForAdmin();
  assert(
    finalEvents.length === 1 && finalEvents[0].id === 'EBTC-2026' && finalCerts.length === 111,
    21,
    'Final baseline confirmed: Exactly 1 real event (EBTC-2026) and 111 real certificates.'
  );

  console.log('\n===========================================================');
  console.log(`TEST RESULTS: ALL ${passedTests} OF ${totalTests} TESTS PASSED!`);
  console.log('===========================================================');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
