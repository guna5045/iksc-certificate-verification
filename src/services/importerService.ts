import * as XLSX from 'xlsx';
import { CertificateRecord, EventInfo, SpreadsheetValidationResult, SpreadsheetValidationRow } from '../types/certificate';

export class ImporterService {
  /**
   * Parse an uploaded CSV or XLSX file in the browser
   */
  public async parseFile(file: File): Promise<any[]> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Read raw rows as array of objects
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return jsonData;
  }

  /**
   * Normalize field names across common variations
   */
  private extractField(row: any, candidates: string[]): string {
    const keys = Object.keys(row);
    for (const cand of candidates) {
      const matchedKey = keys.find(k => k.trim().toLowerCase() === cand.toLowerCase());
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
        return String(row[matchedKey]).trim();
      }
    }
    return '';
  }

  /**
   * Validate uploaded participant sheet before any database insertion
   */
  public validateRows(
    rawRows: any[], 
    existingRegNumbers: Set<string> = new Set()
  ): SpreadsheetValidationResult {
    const resultRows: SpreadsheetValidationRow[] = [];
    const errorSummary: string[] = [];
    const seenRegNosInFile = new Set<string>();

    if (!rawRows || rawRows.length === 0) {
      errorSummary.push('The uploaded spreadsheet is empty.');
      return {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        rows: [],
        errorSummary
      };
    }

    // Check required header presence on first row
    const firstRow = rawRows[0];
    const hasNameCol = this.extractField(firstRow, ['full name', 'fullname', 'name', 'participant name']) !== '';
    const hasRegCol = this.extractField(firstRow, ['registration number', 'reg no', 'reg_no', 'regno', 'roll no']) !== '';
    const hasYearCol = this.extractField(firstRow, ['year', 'year of study']) !== '';
    const hasDeptCol = this.extractField(firstRow, ['department', 'dept', 'branch']) !== '';

    if (!hasNameCol && !hasRegCol && !hasYearCol && !hasDeptCol) {
      errorSummary.push('Required columns missing. Expected: "Full Name", "Registration Number", "Year", "Department".');
    }

    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // Row 1 is header, Row 2 is first data row
      const errors: string[] = [];

      const fullName = this.extractField(row, ['full name', 'fullname', 'name', 'participant name']);
      const regNo = this.extractField(row, ['registration number', 'reg no', 'reg_no', 'regno', 'roll no']);
      const year = this.extractField(row, ['year', 'year of study']);
      const department = this.extractField(row, ['department', 'dept', 'branch']);
      const collegeEmail = this.extractField(row, ['college email id', 'college email', 'email', 'email id']);

      // Check for completely empty row
      if (!fullName && !regNo && !year && !department) {
        return; // Skip blank trailing rows
      }

      if (!fullName) {
        errors.push(`Row ${rowNum}: Full Name is missing.`);
      }

      if (!regNo) {
        errors.push(`Row ${rowNum}: Registration Number is missing.`);
      } else {
        const normReg = regNo.toUpperCase();
        if (seenRegNosInFile.has(normReg)) {
          errors.push(`Row ${rowNum}: Duplicate Registration Number "${regNo}" in uploaded sheet.`);
        } else {
          seenRegNosInFile.add(normReg);
        }

        if (existingRegNumbers.has(normReg)) {
          errors.push(`Row ${rowNum}: Registration Number "${regNo}" is already issued a certificate for this event.`);
        }
      }

      if (!year) {
        errors.push(`Row ${rowNum}: Year is missing.`);
      }

      if (!department) {
        errors.push(`Row ${rowNum}: Department is missing.`);
      }

      if (errors.length > 0) {
        errorSummary.push(...errors);
      }

      resultRows.push({
        rowNumber: rowNum,
        fullName,
        registrationNumber: regNo,
        year,
        department,
        collegeEmail,
        errors
      });
    });

    const invalidCount = resultRows.filter(r => r.errors.length > 0).length;
    const validCount = resultRows.length - invalidCount;

    return {
      totalRows: resultRows.length,
      validRows: validCount,
      invalidRows: invalidCount,
      rows: resultRows,
      errorSummary
    };
  }

  /**
   * Transform valid spreadsheet rows into official IKSC Certificate records
   */
  public generateCertificates(
    event: EventInfo,
    validRows: SpreadsheetValidationRow[],
    currentEventCount = 0
  ): CertificateRecord[] {
    const certs: CertificateRecord[] = [];

    validRows.forEach((row, idx) => {
      // Independent serial numbering per event starting at 0001
      const serialIndex = currentEventCount + idx + 1;
      const serialPad = String(serialIndex).padStart(4, '0');
      const certId = `IKSC-${event.code}-${event.year}-${serialPad}`;

      certs.push({
        id: certId,
        eventId: event.id,
        participantName: row.fullName.toUpperCase().trim(),
        registrationNumber: row.registrationNumber.trim(),
        yearOfStudy: row.year.trim(),
        department: row.department.trim(),
        collegeEmail: row.collegeEmail ? row.collegeEmail.trim() : undefined,
        eventName: event.name,
        eventDates: event.dates,
        issuedBy: 'IUCEE KARE Student Chapter',
        certificateType: 'Participation',
        issueDate: event.dates.split('and ').pop() || `${event.year}`,
        status: 'VALID'
      });
    });

    return certs;
  }
}

export const importerService = new ImporterService();
