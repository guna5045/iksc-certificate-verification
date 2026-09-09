import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const certsPath = path.join(__dirname, '..', 'src', 'data', 'certificates', 'ebtc-2026.json');
const certs = JSON.parse(fs.readFileSync(certsPath, 'utf-8'));

const sqlLines = [
  '-- =========================================================================',
  '-- IUCEE KARE Student Chapter: Seed 111 EBTC Certificates into Supabase',
  '-- =========================================================================',
  '',
  'INSERT INTO public.certificates (id, event_id, participant_name, registration_number, year_of_study, department, certificate_type, issue_date, status)',
  'VALUES'
];

const valueRows = certs.map((c, i) => {
  const isLast = i === certs.length - 1;
  const name = c.participantName.replace(/'/g, "''");
  const dept = c.department.replace(/'/g, "''");
  return `  ('${c.id}', '${c.eventId}', '${name}', '${c.registrationNumber}', '${c.yearOfStudy}', '${dept}', '${c.certificateType}', '${c.issueDate}', '${c.status}')${isLast ? '' : ','}`;
});

sqlLines.push(...valueRows);
sqlLines.push('ON CONFLICT (id) DO UPDATE SET');
sqlLines.push('  participant_name = EXCLUDED.participant_name,');
sqlLines.push('  registration_number = EXCLUDED.registration_number,');
sqlLines.push('  year_of_study = EXCLUDED.year_of_study,');
sqlLines.push('  department = EXCLUDED.department,');
sqlLines.push('  status = EXCLUDED.status;');

const outputPath = path.join(__dirname, '..', 'supabase', 'seed_ebtc_111.sql');
fs.writeFileSync(outputPath, sqlLines.join('\n'));
console.log(`Generated ${outputPath} with ${certs.length} certificates.`);
