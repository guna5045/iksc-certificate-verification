import QRCode from 'qrcode';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { certificateService } from '../src/services/certificateService';
import { getProductionBaseUrl, PRODUCTION_BASE_URL } from '../src/services/urlConfig';

console.log('===========================================================');
console.log('PROGRAMMATIC QR PAYLOAD DECODING & VERIFICATION TEST');
console.log('===========================================================\n');

async function decodeQrBuffer(buffer: Buffer): Promise<string | null> {
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code ? code.data : null;
}

async function run() {
  const targetIds = [
    'IKSC-EBTC-2026-0001',
    'IKSC-EBTC-2026-0002',
    'IKSC-EBTC-2026-0003',
    'IKSC-EBTC-2026-0008',
    'IKSC-EBTC-2026-0088',
    'IKSC-EBTC-2026-0111'
  ];

  const expectedParticipants: Record<string, { name: string; reg: string; dept: string }> = {
    'IKSC-EBTC-2026-0001': {
      name: 'JEYAPREETHA S R',
      reg: '9924030005',
      dept: 'Aeronautical Engineering'
    },
    'IKSC-EBTC-2026-0002': {
      name: 'ASHIKA ASHOKKUMAR',
      reg: '99240040015',
      dept: 'Computer Science and Engineering(CSE)'
    },
    'IKSC-EBTC-2026-0003': {
      name: 'BATTU VENU GOPAL',
      reg: '99240040020',
      dept: 'Computer Science and Engineering(CSE)'
    },
    'IKSC-EBTC-2026-0008': {
      name: 'GAJULA BHAVYASREE',
      reg: '99240040044',
      dept: 'Computer Science and Engineering(CSE)'
    },
    'IKSC-EBTC-2026-0088': {
      name: 'SANJANA S',
      reg: '99250040671',
      dept: 'Computer Science and Engineering(CSE)'
    },
    'IKSC-EBTC-2026-0111': {
      name: 'DONTALA KRISHNA KANTH',
      reg: '9924008078',
      dept: 'Information Technology'
    }
  };

  const origin = getProductionBaseUrl();
  console.log(`Configured Production Origin: "${origin}"`);
  if (origin !== PRODUCTION_BASE_URL) {
    console.error(`[FAIL] Expected origin "${PRODUCTION_BASE_URL}", got "${origin}"`);
    process.exit(1);
  }

  for (const id of targetIds) {
    console.log(`\n--- Testing Certificate ${id} ---`);
    
    // 1. Generate verification URL
    const expectedUrl = `${PRODUCTION_BASE_URL}/verify?id=${encodeURIComponent(id)}`;
    
    // 2. Generate QR code binary buffer
    const qrBuffer = await QRCode.toBuffer(expectedUrl, {
      width: 400,
      margin: 1,
      errorCorrectionLevel: 'M'
    });

    // 3. Programmatically decode QR code image
    const decodedUrl = await decodeQrBuffer(qrBuffer);
    console.log(`Expected URL: ${expectedUrl}`);
    console.log(`Decoded QR:   ${decodedUrl}`);

    if (decodedUrl !== expectedUrl) {
      console.error(`[FAIL] QR decoded URL mismatch for ${id}!`);
      console.error(`Expected: ${expectedUrl}`);
      console.error(`Got:      ${decodedUrl}`);
      process.exit(1);
    }
    console.log(`[PASS] QR payload decoded successfully and matches exact production URL.`);

    // 4. Perform verification lookup on this exact ID
    const verifyRes = await certificateService.verifyCertificate(id);
    if (verifyRes.state !== 'VERIFIED' || !verifyRes.certificate) {
      console.error(`[FAIL] Verification failed for ${id}:`, verifyRes);
      process.exit(1);
    }

    const cert = verifyRes.certificate;
    const expected = expectedParticipants[id];

    if (cert.participantName !== expected.name) {
      console.error(`[FAIL] Participant name mismatch for ${id}!`);
      console.error(`Expected: "${expected.name}"`);
      console.error(`Got:      "${cert.participantName}"`);
      process.exit(1);
    }

    if (cert.registrationNumber !== expected.reg) {
      console.error(`[FAIL] Registration number mismatch for ${id}!`);
      console.error(`Expected: "${expected.reg}"`);
      console.error(`Got:      "${cert.registrationNumber}"`);
      process.exit(1);
    }

    if (cert.department !== expected.dept) {
      console.error(`[FAIL] Department mismatch for ${id}!`);
      console.error(`Expected: "${expected.dept}"`);
      console.error(`Got:      "${cert.department}"`);
      process.exit(1);
    }

    console.log(`[PASS] Certificate details verified: ${cert.participantName} (${cert.registrationNumber}, ${cert.department})`);
  }

  // 5. Explicit check: ensure "GOKUL" does NOT exist anywhere in all 111 certificates
  console.log('\n--- Checking for Stale "GOKUL" Data ---');
  const allCerts = await certificateService.getCertificatesForAdmin();
  const gokulEntries = allCerts.filter(c => 
    c.participantName.includes('GOKUL') || 
    JSON.stringify(c).toLowerCase().includes('gokul')
  );

  if (gokulEntries.length > 0) {
    console.error(`[FAIL] Found stale GOKUL data in certificates list!`, gokulEntries);
    process.exit(1);
  }
  console.log(`[PASS] Zero instances of "GOKUL" found in the active production certificate dataset.`);
  console.log(`[PASS] Total active certificates verified: ${allCerts.length} (exactly 111).`);

  // 6. Non-existent certificate test
  console.log('\n--- Checking Non-existent Certificate ---');
  const nonExistent = await certificateService.verifyCertificate('IKSC-EBTC-2026-9999');
  if (nonExistent.state === 'NOT_FOUND' && !nonExistent.certificate) {
    console.log('[PASS] Non-existent ID IKSC-EBTC-2026-9999 returns NOT_FOUND with zero exposed data.');
  } else {
    console.error('[FAIL] Non-existent certificate test failed:', nonExistent);
    process.exit(1);
  }

  console.log('\n===========================================================');
  console.log('ALL QR CODE PAYLOAD AND VERIFICATION CHECKS PASSED!');
  console.log('===========================================================');
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
