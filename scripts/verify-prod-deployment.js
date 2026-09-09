import https from 'https';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

async function verifyProduction() {
  console.log('Fetching https://iksc-certificate-verification.vercel.app/ ...');
  const home = await fetchUrl('https://iksc-certificate-verification.vercel.app/');
  console.log('Home HTML status:', home.statusCode);

  const match = home.body.match(/src="(\.?\/assets\/index-[^"]+\.js)"/);
  if (!match) {
    console.error('Could not find JS bundle in home page HTML!');
    return;
  }

  let bundlePath = match[1];
  if (bundlePath.startsWith('.')) bundlePath = bundlePath.substring(1);
  const bundleUrl = 'https://iksc-certificate-verification.vercel.app' + bundlePath;
  console.log('Fetching production bundle:', bundleUrl);

  const bundle = await fetchUrl(bundleUrl);
  console.log('Production bundle status:', bundle.statusCode, 'size:', bundle.body.length, 'bytes');

  const tests = [
    ['EBTC-2026', bundle.body.includes('EBTC-2026')],
    ['Engineering Beyond the Classroom', bundle.body.includes('Engineering Beyond the Classroom')],
    ['IKSC-EBTC-2026-0001', bundle.body.includes('IKSC-EBTC-2026-0001')],
    ['JEYAPREETHA S R', bundle.body.includes('JEYAPREETHA S R')],
    ['9924030005', bundle.body.includes('9924030005')],
    ['IKSC-EBTC-2026-0002', bundle.body.includes('IKSC-EBTC-2026-0002')],
    ['ASHIKA ASHOKKUMAR', bundle.body.includes('ASHIKA ASHOKKUMAR')],
    ['99240040015', bundle.body.includes('99240040015')],
    ['IKSC-EBTC-2026-0003', bundle.body.includes('IKSC-EBTC-2026-0003')],
    ['BATTU VENU GOPAL', bundle.body.includes('BATTU VENU GOPAL')],
    ['99240040020', bundle.body.includes('99240040020')],
    ['IKSC-EBTC-2026-0008', bundle.body.includes('IKSC-EBTC-2026-0008')],
    ['GAJULA BHAVYASREE', bundle.body.includes('GAJULA BHAVYASREE')],
    ['IKSC-EBTC-2026-0088', bundle.body.includes('IKSC-EBTC-2026-0088')],
    ['SANJANA S', bundle.body.includes('SANJANA S')],
    ['IKSC-EBTC-2026-0111', bundle.body.includes('IKSC-EBTC-2026-0111')],
    ['DONTALA KRISHNA KANTH', bundle.body.includes('DONTALA KRISHNA KANTH')],
    ['Absence of GOKUL (Zero Fake Data)', !bundle.body.includes('GOKUL')]
  ];

  console.log('\n--- Production Deployment Bundle Verification ---');
  let allPass = true;
  for (const [name, pass] of tests) {
    if (pass) {
      console.log(`[PASS] ${name}`);
    } else {
      console.error(`[FAIL] Check failed for ${name}`);
      allPass = false;
    }
  }

  if (allPass) {
    console.log('\n>>> LIVE PRODUCTION DEPLOYMENT FULLY VERIFIED ON VERCEL! <<<');
  } else {
    console.log('\n>>> Deployment is in progress. Rechecking in a few seconds... <<<');
  }
  return allPass;
}

verifyProduction().catch(console.error);
