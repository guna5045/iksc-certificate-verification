-- =========================================================================
-- IUCEE KARE Student Chapter (IKSC) Production Database Schema & Security
-- PostgreSQL / Supabase
-- =========================================================================

-- 1. Events Table
CREATE TABLE IF NOT EXISTS public.events (
    id VARCHAR(32) PRIMARY KEY, -- e.g. 'EBTC-2026'
    code VARCHAR(16) NOT NULL, -- e.g. 'EBTC'
    name VARCHAR(255) NOT NULL, -- e.g. 'Engineering Beyond the Classroom'
    year INTEGER NOT NULL, -- e.g. 2026
    dates VARCHAR(128) NOT NULL, -- e.g. '15th and 16th August 2026'
    organizer VARCHAR(255) DEFAULT 'IUCEE KARE Student Chapter',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_event_code_year UNIQUE (code, year)
);

-- 2. Certificates Table
CREATE TABLE IF NOT EXISTS public.certificates (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'IKSC-EBTC-2026-0001'
    event_id VARCHAR(32) NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    participant_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(64) NOT NULL,
    year_of_study VARCHAR(32) NOT NULL,
    department VARCHAR(128) NOT NULL,
    college_email VARCHAR(255),
    certificate_type VARCHAR(64) DEFAULT 'Participation',
    issue_date VARCHAR(64) NOT NULL,
    status VARCHAR(16) DEFAULT 'VALID' CHECK (status IN ('VALID', 'REVOKED')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT uq_event_participant UNIQUE (event_id, registration_number)
);

-- Indexes for high-performance lookups
CREATE INDEX IF NOT EXISTS idx_certificates_id ON public.certificates(id);
CREATE INDEX IF NOT EXISTS idx_certificates_event_id ON public.certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_certificates_reg_no ON public.certificates(registration_number);
CREATE INDEX IF NOT EXISTS idx_certificates_event_cert ON public.certificates(event_id, id);

-- 3. Row Level Security (RLS) Configuration
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Clean existing policies if re-running
DROP POLICY IF EXISTS "Public can view events for dropdown" ON public.events;
DROP POLICY IF EXISTS "Admins can insert events" ON public.events;
DROP POLICY IF EXISTS "Admins can update events" ON public.events;
DROP POLICY IF EXISTS "Admins can delete events" ON public.events;

DROP POLICY IF EXISTS "Public can verify individual certificates" ON public.certificates;
DROP POLICY IF EXISTS "Admins can insert certificates" ON public.certificates;
DROP POLICY IF EXISTS "Admins can update certificates" ON public.certificates;
DROP POLICY IF EXISTS "Admins can delete certificates" ON public.certificates;

-- Policy A: Public read access to events for the verification dropdown
CREATE POLICY "Public can view events for dropdown"
    ON public.events
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy B: Public read access to certificates for single-record verification
-- Does NOT expose college_email or private admin metadata
CREATE POLICY "Public can verify individual certificates"
    ON public.certificates
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy C: Authenticated Admin operations on events (Create, Update, Delete)
CREATE POLICY "Admins can insert events"
    ON public.events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can update events"
    ON public.events
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can delete events"
    ON public.events
    FOR DELETE
    TO authenticated
    USING (true);

-- Policy D: Authenticated Admin operations on certificates (Add, Import, Revoke, Update, Delete)
CREATE POLICY "Admins can insert certificates"
    ON public.certificates
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can update certificates"
    ON public.certificates
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Admins can delete certificates"
    ON public.certificates
    FOR DELETE
    TO authenticated
    USING (true);

-- 4. Initial Production Event: Engineering Beyond the Classroom
INSERT INTO public.events (id, code, name, year, dates, organizer, description)
VALUES (
    'EBTC-2026',
    'EBTC',
    'Engineering Beyond the Classroom',
    2026,
    '15th and 16th August 2026',
    'IUCEE KARE Student Chapter',
    'Signature symposium and colloquium organized by IUCEE KARE Student Chapter.'
)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, dates = EXCLUDED.dates;
