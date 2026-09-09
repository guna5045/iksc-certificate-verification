/**
 * Production Domain / Base URL Configuration for QR Code Generation
 * 
 * QR codes must contain only the public verification destination URL.
 * In production, this uses VITE_PUBLIC_DOMAIN if configured, or the browser's current origin.
 */
export const getProductionBaseUrl = (): string => {
  // 1. Check environment variable first (e.g. set in Vercel/Netlify/Hostinger)
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

  // 2. In browser, use the current active origin (e.g. deployed production domain)
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    return window.location.origin;
  }

  // 3. Fallback default domain
  return 'https://iksc.klu.ac.in';
};
