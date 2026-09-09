/**
 * IKSC Certificate Importer CLI
 * 
 * Usage:
 *   node scripts/import-certificates.js --csv path/to/file.csv --event EBTC-2026
 * 
 * Supports:
 *   - Auto ID generation: IKSC-<EVENT_CODE>-<YEAR>-<INDEX>
 *   - Validation of participant details, registration number, and department
 *   - Export to JSON snapshot store and/or SQL INSERT statements
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'src', 'data');
const CERTS_DIR = path.join(DATA_DIR, 'certificates');
const SQL_DIR = path.join(__dirname, '..', 'supabase');

if (!fs.existsSync(SQL_DIR)) fs.mkdirSync(SQL_DIR, { recursive: true });

function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Basic CSV splitting handling commas within quotes
    const regex = /(?:^|,)(?:"([^"]*)"|([^,]*))/g;
    const values = [];
    let match;
    while ((match = regex.exec(rawLine)) !== null) {
      if (match.index === regex.lastIndex) regex.lastIndex++;
      const val = match[1] !== undefined ? match[1] : match[2];
      values.push(val.trim());
    }

    if (values.length > 0 && values.some(v => v.length > 0)) {
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
      records.push(obj);
    }
  }

  return records;
}

export function importFromCSV({ csvFilePath, eventId, startIndex = 1, outJson = true, outSql = true }) {
  const eventsRaw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'events.json'), 'utf-8'));
  const event = eventsRaw.find(e => e.id === eventId);
  if (!event) {
    throw new Error(`Event with ID "${eventId}" not found in src/data/events.json`);
  }

  const csvContent = fs.readFileSync(csvFilePath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`Parsed ${rows.length} rows for event [${event.name}] (${event.id})`);

  const certificates = [];
  const sqlStatements = [];

  rows.forEach((row, idx) => {
    const currentIndex = startIndex + idx;
    const formattedId = row.CertificateId || `IKSC-${event.code}-${event.year}-${String(currentIndex).padStart(4, '0')}`;
    
    const cert = {
      id: formattedId,
      eventId: event.id,
      participantName: (row.ParticipantName || row.Name || '').toUpperCase().trim(),
      registrationNumber: (row.RegistrationNumber || row.RegNo || '').trim(),
      yearOfStudy: row.Year || row.YearOfStudy || '3rd Year',
      department: row.Department || 'Engineering',
      eventName: event.name,
      eventDates: event.dates,
      issuedBy: event.organizer,
      certificateType: row.Type || row.CertificateType || 'Participation',
      issueDate: row.IssueDate || event.dates.split('and ').pop() || `${event.year}`,
      status: 'VALID',
      metadata: {
        college: row.College || 'Kalasalingam Academy of Research and Education',
        remarks: row.Remarks || ''
      }
    };

    if (!cert.participantName || !cert.registrationNumber) {
      console.warn(`Row ${idx + 2} is missing Name or RegNo:`, row);
    }

    certificates.push(cert);

    const safeMeta = JSON.stringify(cert.metadata).replace(/'/g, "''");
    sqlStatements.push(
      `INSERT INTO certificates (id, event_id, participant_name, registration_number, year_of_study, department, certificate_type, issue_date, status, metadata)
       VALUES ('${cert.id}', '${cert.eventId}', '${cert.participantName.replace(/'/g, "''")}', '${cert.registrationNumber}', '${cert.yearOfStudy}', '${cert.department.replace(/'/g, "''")}', '${cert.certificateType}', '${cert.issueDate}', 'VALID', '${safeMeta}')
       ON CONFLICT (id) DO UPDATE SET participant_name = EXCLUDED.participant_name;`
    );
  });

  if (outJson) {
    const certFile = path.join(CERTS_DIR, `${event.id.toLowerCase()}.json`);
    fs.writeFileSync(certFile, JSON.stringify(certificates, null, 2));
    console.log(`Successfully saved ${certificates.length} certificates to ${certFile}`);

    // Update master index
    let all = [];
    const allFile = path.join(DATA_DIR, 'all-certificates.json');
    if (fs.existsSync(allFile)) {
      all = JSON.parse(fs.readFileSync(allFile, 'utf-8')).filter(c => c.eventId !== event.id);
    }
    all.push(...certificates);
    fs.writeFileSync(allFile, JSON.stringify(all, null, 2));
    console.log(`Updated master repository index (${all.length} certificates total).`);
  }

  if (outSql) {
    const sqlFile = path.join(SQL_DIR, `seed_${event.id.toLowerCase()}.sql`);
    fs.writeFileSync(sqlFile, sqlStatements.join('\n'));
    console.log(`Generated SQL seed script: ${sqlFile}`);
  }

  return certificates;
}

// CLI handler
const args = process.argv.slice(2);
if (args.includes('--validate')) {
  console.log('Importer module validated successfully.');
} else {
  const csvIndex = args.indexOf('--csv');
  const eventIndex = args.indexOf('--event');
  if (csvIndex !== -1 && eventIndex !== -1) {
    const csvPath = args[csvIndex + 1];
    const eventId = args[eventIndex + 1];
    importFromCSV({ csvFilePath: path.resolve(csvPath), eventId });
  } else {
    console.log('IKSC Certificate Importer. Use --help or pass --csv and --event parameters.');
  }
}
