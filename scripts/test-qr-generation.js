import QRCode from 'qrcode';

async function testQR() {
  const url = 'https://iksc.org/verify?id=IKSC-EBTC-2026-0001';
  const qr = await QRCode.toDataURL(url, {
    width: 380,
    margin: 1,
    errorCorrectionLevel: 'M'
  });

  if (qr && qr.startsWith('data:image/png;base64,')) {
    console.log('[PASS] QR Code generated successfully.');
    console.log(`[PASS] Data URL length: ${qr.length} characters.`);
    console.log(`[PASS] Encoded verification URL: ${url}`);
  } else {
    console.error('[FAIL] QR code generation failed.');
    process.exit(1);
  }
}

testQR();
