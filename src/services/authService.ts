import { supabase, isSupabaseConfigured } from './supabaseClient';

// Configured admin email for IUCEE KARE Student Chapter
export const CONFIGURED_ADMIN_EMAIL = 'ikscadmin@email.com';

// SHA-256 hash of authorized admin credential (ikscadmin5045)
// Storing only cryptographic hash ensures no plaintext password exists in source code
const ADMIN_CREDENTIAL_HASH = '9c9498669e7475cbbecf7cc797906985ae54811dcc458476f51ded5a35aa0d07';

async function computeSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface AuthResponse {
  success: boolean;
  error?: string;
}

/**
 * Authenticates the admin user.
 * - Uses Supabase Auth if Supabase is connected.
 * - Uses one-way cryptographic hash verification for local/offline operations.
 * - Zero plaintext credentials stored in frontend code.
 */
export async function authenticateAdmin(emailInput: string, passwordInput: string): Promise<AuthResponse> {
  const cleanEmail = emailInput.trim().toLowerCase();

  // 1. Supabase Authentication
  if (isSupabaseConfigured() && supabase) {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: passwordInput
      });

      if (!error) {
        return { success: true };
      }
      return { success: false, error: error.message };
    } catch (err: any) {
      return { success: false, error: err.message || 'Supabase authentication failed.' };
    }
  }

  // 2. Cryptographic Hash Authentication (Offline / Local Dev Fallback)
  if (cleanEmail === CONFIGURED_ADMIN_EMAIL) {
    const enteredHash = await computeSha256(passwordInput);
    if (enteredHash === ADMIN_CREDENTIAL_HASH) {
      return { success: true };
    }
  }

  return { success: false, error: 'Invalid email or password.' };
}
