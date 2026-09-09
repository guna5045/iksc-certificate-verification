/**
 * Production Domain / Base URL Configuration for QR Code Generation
 * 
 * QR codes must contain only the public verification destination URL.
 * Production Domain: https://iksc-certificate-verification.vercel.app
 * Newly generated QR codes must ALWAYS use this production domain (NEVER localhost).
 */
export const PRODUCTION_BASE_URL = 'https://iksc-certificate-verification.vercel.app';

export const getProductionBaseUrl = (): string => {
  // 1. Check environment variable first (if explicitly configured)
  const envUrl = 
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PUBLIC_DOMAIN) ||
    (typeof process !== 'undefined' && process.env?.VITE_PUBLIC_DOMAIN);

  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    let clean = envUrl.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    return clean.replace(/\/+$/, '');
  }

  // 2. In browser, use current active origin ONLY if it is a production deployment (never localhost or 127.0.0.1)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin.replace(/\/+$/, '');
    }
  }

  // 3. Strict production fallback: NEVER localhost
  return PRODUCTION_BASE_URL;
};
