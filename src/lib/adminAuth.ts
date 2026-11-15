import { supabase } from './supabase';

export interface AdminVerificationResult {
  isAdmin: boolean;
  email: string | null;
  mode: 'pin' | 'supabase' | null;
}

export interface PinVerificationResult {
  ok: boolean;
  error?: string;
  notConfigured?: boolean;
}

const ADMIN_TOKEN_STORAGE_KEY = 'karya_admin_session_token_v1';
let rpcPinUnlocked = false;

function getStoredToken(): string | null {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setStoredToken(token: string) {
  try {
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Verifies the Admin PIN strictly via:
 * 1) Secure Supabase RPC (`public.verify_admin_pin`, bcrypt-hashed `pin_hash` in `platform_admins`), OR
 * 2) Server-side endpoint (`/api/admin/verify-pin` reading server-only `ADMIN_PIN` / Supabase RPC).
 *
 * No PIN or hash secret is ever stored or embedded in browser code.
 */
export async function verifyAdminPin(pinInput: string): Promise<PinVerificationResult> {
  const pin = pinInput.trim();
  if (!pin) {
    return { ok: false, error: 'يرجى إدخال الرمز السري للإدارة.' };
  }

  let serverErrorMsg: string | undefined;

  // 1. Primary: Server-side verification (/api/admin/verify-pin checks ADMIN_PIN or Supabase verify_admin_pin RPC)
  try {
    const res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pin }),
    });

    const payload = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      token?: string;
      error?: string;
      notConfigured?: boolean;
    };

    if (res.ok && payload.ok) {
      if (payload.token) {
        setStoredToken(payload.token);
      }
      return { ok: true };
    }

    if (res.status === 401) {
      return {
        ok: false,
        error: payload.error || 'الرمز السري غير صحيح. يرجى التحقق والمحاولة مرة أخرى.',
      };
    }

    if (payload.error) {
      serverErrorMsg = payload.error;
    }
  } catch {
    // Backend unavailable; proceed to direct Supabase RPC verification
  }

  // 2. Direct Secure Supabase RPC (SECURITY DEFINER + pgcrypto bcrypt against platform_admins.pin_hash)
  try {
    const { data, error } = await supabase.rpc('verify_admin_pin', { p_pin: pin });
    if (!error) {
      if (data === true) {
        rpcPinUnlocked = true;
        return { ok: true };
      }
      return {
        ok: false,
        error: 'الرمز السري غير صحيح. يرجى التحقق والمحاولة مرة أخرى.',
      };
    }
  } catch {
    // RPC unavailable or not deployed yet
  }

  return {
    ok: false,
    notConfigured: true,
    error:
      serverErrorMsg ||
      'تعذر التحقق من الرمز السري. تأكد من تشغيل دالة verify_admin_pin في Supabase أو ضبط ADMIN_PIN على الخادم، أو سجّل الدخول بحساب المسؤول.',
  };
}

export async function logoutAdminAccess(): Promise<void> {
  rpcPinUnlocked = false;
  try {
    window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // Ignore network errors on logout
  }
}

/**
 * Programmatically verifies that the current visitor has either:
 * 1) A server-signed Admin PIN session or verified Supabase RPC unlock, OR
 * 2) An authenticated Supabase user registered in public.platform_admins.
 */
export async function verifyAdminAccess(): Promise<AdminVerificationResult> {
  // 1. Server-signed session check (HMAC-SHA256 cookie / Bearer token)
  try {
    const token = getStoredToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch('/api/admin/session', {
      method: 'GET',
      headers,
      credentials: 'include',
    });
    if (res.ok) {
      const data = (await res.json()) as { authenticated?: boolean };
      if (data.authenticated) {
        return { isAdmin: true, email: null, mode: 'pin' };
      }
    }
  } catch {
    // Ignore if backend session check fails
  }

  // 2. In-memory Supabase RPC PIN unlock check
  if (rpcPinUnlocked) {
    return { isAdmin: true, email: null, mode: 'pin' };
  }

  // 3. Supabase platform_admins session check
  try {
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    const userEmail = session?.user?.email?.trim().toLowerCase() ?? null;
    if (sessionErr || !session?.user || !userEmail) {
      return { isAdmin: false, email: null, mode: null };
    }

    const { data, error } = await supabase
      .from('platform_admins')
      .select('user_id, email')
      .ilike('email', userEmail)
      .maybeSingle();

    if (error || !data || !data.email) {
      return { isAdmin: false, email: userEmail, mode: null };
    }

    const matched = data.email.trim().toLowerCase() === userEmail;
    return {
      isAdmin: matched,
      email: userEmail,
      mode: matched ? 'supabase' : null,
    };
  } catch {
    return { isAdmin: false, email: null, mode: null };
  }
}
