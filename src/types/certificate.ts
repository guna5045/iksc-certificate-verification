export type CertificateStatus = 'VALID' | 'REVOKED' | 'SUSPENDED';

export type CertificateType = 'Participation' | 'Merit' | 'Appreciation' | 'Winner' | 'Runner Up' | 'Coordinator';

export interface EventInfo {
  id: string; // e.g. 'EBTC-2026'
  code: string; // e.g. 'EBTC'
  name: string; // e.g. 'Engineering Beyond the Classroom'
  year: number; // e.g. 2026
  dates: string; // e.g. '15th and 16th August 2026'
  organizer: string; // 'IUCEE KARE Student Chapter'
  description?: string;
  category?: string;
  location?: string;
  totalIssued?: number;
}

export interface CertificateRecord {
  id: string; // e.g. 'IKSC-EBTC-2026-0001'
  eventId: string; // e.g. 'EBTC-2026'
  participantName: string; // e.g. 'JEYAPREETHA S R'
  registrationNumber: string; // e.g. '9924030005'
  yearOfStudy: string; // e.g. '3rd Year'
  department: string; // e.g. 'Aeronautical Engineering'
  collegeEmail?: string;
  eventName: string; // e.g. 'Engineering Beyond the Classroom'
  eventDates: string; // e.g. '15th and 16th August 2026'
  issuedBy: string; // 'IUCEE KARE Student Chapter'
  certificateType: CertificateType | string;
  issueDate: string; // e.g. '16th August 2026'
  status: CertificateStatus;
  metadata?: {
    college?: string;
    remarks?: string;
  };
}

export interface VerificationResult {
  state: 'VERIFIED' | 'INVALID_FORMAT' | 'NOT_FOUND' | 'REVOKED';
  certificate?: CertificateRecord;
  event?: EventInfo;
  errorMessage?: string;
  searchedId?: string;
}

export interface SpreadsheetValidationRow {
  rowNumber: number;
  fullName: string;
  registrationNumber: string;
  year: string;
  department: string;
  collegeEmail?: string;
  errors: string[];
}

export interface SpreadsheetValidationResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: SpreadsheetValidationRow[];
  errorSummary: string[];
}
