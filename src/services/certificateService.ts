import { CertificateRecord, EventInfo, VerificationResult } from '../types/certificate';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import defaultEvents from '../data/events.json';

// Standard IKSC ID Regex: e.g. IKSC-EBTC-2026-0001
export const CERTIFICATE_ID_REGEX = /^IKSC-[A-Z0-9]+-\d{4}-\d{4}$/i;

class CertificateService {
  private localEvents: EventInfo[] = defaultEvents as EventInfo[];
  private localCertificates: CertificateRecord[] = [];
  private localLoaded = false;

  private async ensureLocalDataLoaded(): Promise<void> {
    if (!this.localLoaded) {
      try {
        const ebtcData = (await import('../data/certificates/ebtc-2026.json')).default as CertificateRecord[];
        this.localCertificates = [...ebtcData];
        this.localLoaded = true;
      } catch (e) {
        console.warn('Could not load fallback certificates', e);
      }
    }
  }

  public normalizeId(rawId: string | null | undefined): string {
    if (!rawId) return '';
    return decodeURIComponent(rawId).trim().toUpperCase();
  }

  public isValidIdFormat(id: string): boolean {
    return CERTIFICATE_ID_REGEX.test(id.trim());
  }

  /**
   * Fetch all events for public selector and admin list
   */
  public async getEvents(): Promise<EventInfo[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('events')
          .select('id, code, name, year, dates, organizer, description')
          .order('year', { ascending: false });

        if (!error && data && data.length > 0) {
          this.localEvents = data as EventInfo[];
          return this.localEvents;
        }
      } catch (err) {
        console.warn('Falling back to local events list', err);
      }
    }
    return this.localEvents;
  }

  public async getEventById(eventId: string): Promise<EventInfo | undefined> {
    const events = await this.getEvents();
    return events.find(e => e.id.toLowerCase() === eventId.toLowerCase());
  }

  /**
   * PUBLIC VERIFICATION
   * - If eventId is provided (from public form): Database query enforces BOTH id AND event_id!
   * - If eventId is omitted (from direct QR scan): Queries exact certificate by id!
   */
  public async verifyCertificate(rawId: string, eventId?: string): Promise<VerificationResult> {
    const id = this.normalizeId(rawId);

    if (!id) {
      return {
        state: 'INVALID_FORMAT',
        searchedId: '',
        errorMessage: 'Please enter a Certificate ID.'
      };
    }

    if (!this.isValidIdFormat(id)) {
      return {
        state: 'NOT_FOUND',
        searchedId: id,
        errorMessage: 'The certificate ID could not be verified.'
      };
    }

    // 1. Supabase Mode: Database level event separation
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase
          .from('certificates')
          .select('id, event_id, participant_name, registration_number, year_of_study, department, certificate_type, issue_date, status, events(id, name, dates, organizer)')
          .eq('id', id);

        if (eventId) {
          // Strictly bind query to the selected event
          query = query.eq('event_id', eventId);
        }

        const { data, error } = await query.maybeSingle();

        if (error || !data) {
          return {
            state: 'NOT_FOUND',
            searchedId: id,
            errorMessage: eventId
              ? 'The certificate ID does not belong to the selected event.'
              : 'The certificate ID could not be verified.'
          };
        }

        const cert: CertificateRecord = {
          id: data.id,
          eventId: data.event_id,
          participantName: data.participant_name,
          registrationNumber: data.registration_number,
          yearOfStudy: data.year_of_study,
          department: data.department,
          eventName: (data.events as any)?.name || 'Engineering Beyond the Classroom',
          eventDates: (data.events as any)?.dates || '15th and 16th August 2026',
          issuedBy: 'IUCEE KARE Student Chapter',
          certificateType: data.certificate_type,
          issueDate: data.issue_date,
          status: data.status
        };

        if (cert.status === 'REVOKED' || cert.status === 'SUSPENDED') {
          return {
            state: 'REVOKED',
            certificate: cert,
            searchedId: id,
            errorMessage: 'This certificate is currently not valid.'
          };
        }

        return {
          state: 'VERIFIED',
          certificate: cert,
          searchedId: id
        };
      } catch (err) {
        console.error('Database query error:', err);
      }
    }

    // 2. Offline / Local Fallback Mode
    await this.ensureLocalDataLoaded();
    const foundCert = this.localCertificates.find(c => c.id.toUpperCase() === id);

    if (!foundCert) {
      return {
        state: 'NOT_FOUND',
        searchedId: id,
        errorMessage: 'The certificate ID could not be verified.'
      };
    }

    // Enforce event separation in local mode as well
    if (eventId && foundCert.eventId.toLowerCase() !== eventId.toLowerCase()) {
      return {
        state: 'NOT_FOUND',
        searchedId: id,
        errorMessage: 'The certificate ID does not belong to the selected event.'
      };
    }

    if (foundCert.status === 'REVOKED' || foundCert.status === 'SUSPENDED') {
      return {
        state: 'REVOKED',
        certificate: foundCert,
        searchedId: id,
        errorMessage: 'This certificate is currently not valid.'
      };
    }

    return {
      state: 'VERIFIED',
      certificate: foundCert,
      searchedId: id
    };
  }

  // -------------------------------------------------------------
  // ADMIN OPERATIONS (Authenticated)
  // -------------------------------------------------------------

  public async addEvent(newEvent: EventInfo): Promise<void> {
    const existing = this.localEvents.find(e => e.id.toLowerCase() === newEvent.id.toLowerCase() || (e.code === newEvent.code && e.year === newEvent.year));
    if (existing) {
      throw new Error(`Event with Code "${newEvent.code}" and Year "${newEvent.year}" already exists.`);
    }

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase.from('events').insert({
        id: newEvent.id,
        code: newEvent.code,
        name: newEvent.name,
        year: newEvent.year,
        dates: newEvent.dates,
        organizer: newEvent.organizer || 'IUCEE KARE Student Chapter',
        description: newEvent.description
      });
      if (error) throw new Error(error.message);
    }
    
    // Prevent duplicate events in local state
    const existingIndex = this.localEvents.findIndex(
      e => e.id.toUpperCase() === newEvent.id.toUpperCase() || (e.code === newEvent.code && e.year === newEvent.year)
    );
    if (existingIndex >= 0) {
      this.localEvents[existingIndex] = newEvent;
    } else {
      this.localEvents.unshift(newEvent);
    }
  }

  public async getCertificatesForAdmin(eventId?: string, limit = 500): Promise<CertificateRecord[]> {
    if (isSupabaseConfigured() && supabase) {
      let query = supabase
        .from('certificates')
        .select('id, event_id, participant_name, registration_number, year_of_study, department, college_email, certificate_type, issue_date, status, events(name, dates)')
        .order('id', { ascending: true })
        .limit(limit);

      if (eventId && eventId !== 'all') {
        query = query.eq('event_id', eventId);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map(d => ({
          id: d.id,
          eventId: d.event_id,
          participantName: d.participant_name,
          registrationNumber: d.registration_number,
          yearOfStudy: d.year_of_study,
          department: d.department,
          collegeEmail: d.college_email,
          eventName: (d.events as any)?.name || 'Event',
          eventDates: (d.events as any)?.dates || '',
          issuedBy: 'IUCEE KARE Student Chapter',
          certificateType: d.certificate_type,
          issueDate: d.issue_date,
          status: d.status
        }));
      }
    }

    // Local mode
    await this.ensureLocalDataLoaded();
    if (eventId && eventId !== 'all') {
      return this.localCertificates.filter(c => c.eventId.toLowerCase() === eventId.toLowerCase());
    }
    return this.localCertificates.slice(0, limit);
  }

  public async importBatchCertificates(certs: CertificateRecord[]): Promise<number> {
    if (certs.length === 0) return 0;

    if (isSupabaseConfigured() && supabase) {
      const rows = certs.map(c => ({
        id: c.id,
        event_id: c.eventId,
        participant_name: c.participantName,
        registration_number: c.registrationNumber,
        year_of_study: c.yearOfStudy,
        department: c.department,
        college_email: c.collegeEmail,
        certificate_type: c.certificateType,
        issue_date: c.issueDate,
        status: c.status
      }));

      const { error } = await supabase.from('certificates').insert(rows);
      if (error) throw new Error(error.message);
    }

    await this.ensureLocalDataLoaded();
    // Prevent duplicate entries by ID
    const map = new Map<string, CertificateRecord>();
    for (const c of this.localCertificates) {
      map.set(c.id.toUpperCase(), c);
    }
    for (const c of certs) {
      map.set(c.id.toUpperCase(), c);
    }
    this.localCertificates = Array.from(map.values());
    return certs.length;
  }

  /**
   * Resets local in-memory dataset to the exact clean production baseline:
   * 1 Event (EBTC-2026) and 111 Certificates (IKSC-EBTC-2026-0001..0111)
   */
  public async resetToProductionDataset(): Promise<void> {
    this.localEvents = [...(defaultEvents as EventInfo[])];
    const ebtcData = (await import('../data/certificates/ebtc-2026.json')).default as CertificateRecord[];
    this.localCertificates = [...ebtcData];
    this.localLoaded = true;
  }

  public async updateCertificateStatus(id: string, status: 'VALID' | 'REVOKED'): Promise<void> {
    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('certificates')
        .update({ status })
        .eq('id', id);
      if (error) throw new Error(error.message);
    }

    await this.ensureLocalDataLoaded();
    const c = this.localCertificates.find(cert => cert.id.toUpperCase() === id.toUpperCase());
    if (c) {
      c.status = status;
    }
  }

  public async getExistingRegNumbersForEvent(eventId: string): Promise<Set<string>> {
    const certs = await this.getCertificatesForAdmin(eventId);
    return new Set(certs.map(c => c.registrationNumber.toUpperCase()));
  }

  public async getCertificateCountForEvent(eventId: string): Promise<number> {
    const certs = await this.getCertificatesForAdmin(eventId);
    return certs.length;
  }
}

export const certificateService = new CertificateService();
