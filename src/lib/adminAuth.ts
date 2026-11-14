import { supabase } from './supabase';

export interface AdminVerificationResult {
  isAdmin: boolean;
  email: string | null;
}

/**
 * Programmatically verifies that the currently authenticated Supabase user
 * has an email registered in public.platform_admins.
 */
export async function verifyAdminAccess(): Promise<AdminVerificationResult> {
  try {
    const {
      data: { session },
      error: sessionErr,
    } = await supabase.auth.getSession();

    const userEmail = session?.user?.email?.trim().toLowerCase() ?? null;
    if (sessionErr || !session?.user || !userEmail) {
      return { isAdmin: false, email: null };
    }

    const { data, error } = await supabase
      .from('platform_admins')
      .select('user_id, email')
      .ilike('email', userEmail)
      .maybeSingle();

    if (error || !data || !data.email) {
      return { isAdmin: false, email: userEmail };
    }

    const matched = data.email.trim().toLowerCase() === userEmail;
    return { isAdmin: matched, email: userEmail };
  } catch {
    return { isAdmin: false, email: null };
  }
}
