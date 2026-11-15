import React, { useEffect, useRef, useState } from 'react';
import { Lock, X, Loader2, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { verifyAdminAccess, verifyAdminPin } from '../lib/adminAuth';
import { supabase } from '../lib/supabase';

interface AdminPinModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({ onClose, onSuccess }) => {
  const [authMode, setAuthMode] = useState<'pin' | 'supabase'>('pin');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (authMode === 'pin') {
      window.setTimeout(() => pinInputRef.current?.focus(), 60);
    }
  }, [authMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const result = await verifyAdminPin(pin);
      if (result.ok) {
        onSuccess();
        return;
      }
      setErrorMsg(result.error || 'الرمز السري غير صحيح. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleSupabaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('fetch') || msg.includes('network') || error.status === 0) {
          setErrorMsg('تعذر الاتصال بخادم المصادقة. يرجى التحقق من الشبكة والمحاولة مرة أخرى.');
        } else {
          setErrorMsg('بيانات الدخول غير صحيحة أو الحساب غير مفعل.');
        }
        return;
      }

      const access = await verifyAdminAccess();
      if (!access.isAdmin) {
        await supabase.auth.signOut();
        setErrorMsg('هذا الحساب غير مخوّل للوصول إلى لوحة إدارة الوساطة.');
        return;
      }

      onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/65 backdrop-blur-xs flex items-center justify-center p-4"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-pin-modal-title"
    >
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl border border-[#E5E0D5] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#EFECE5] bg-ivory/70">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-navy text-gold flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </span>
            <div>
              <h2 id="admin-pin-modal-title" className="font-bold text-sm text-navy">
                دخول إدارة الوساطة
              </h2>
              <p className="text-[11px] text-ink-muted">وصول مقيد لمسؤولي المنصة فقط</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-muted hover:text-navy hover:bg-ivory-dark transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {authMode === 'pin' ? (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-pin-input"
                  className="block text-xs font-semibold text-ink mb-1.5"
                >
                  الرمز السري للإدارة (Admin PIN)
                </label>
                <div className="relative">
                  <input
                    ref={pinInputRef}
                    id="admin-pin-input"
                    type={showPin ? 'text' : 'password'}
                    autoComplete="off"
                    dir="ltr"
                    required
                    placeholder="••••••"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-[#E2DDD3] bg-white pr-3.5 pl-10 py-2.5 text-sm font-mono tracking-widest focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((v) => !v)}
                    aria-label={showPin ? 'إخفاء الرمز' : 'إظهار الرمز'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-navy p-1 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs font-medium text-rose-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl bg-gold hover:bg-gold-hover disabled:opacity-65 text-navy py-2.5 px-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                <span>{loading ? 'جاري التحقق...' : 'فتح لوحة الإدارة'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleSupabaseSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="admin-email-input"
                  className="block text-xs font-semibold text-ink mb-1"
                >
                  البريد الإلكتروني للمسؤول
                </label>
                <input
                  id="admin-email-input"
                  type="email"
                  required
                  dir="ltr"
                  placeholder="admin@karya.ma"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full min-h-[42px] rounded-xl border border-[#E2DDD3] px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-semibold text-ink mb-1"
                >
                  كلمة المرور
                </label>
                <div className="relative">
                  <input
                    id="admin-password-input"
                    type={showPassword ? 'text' : 'password'}
                    required
                    dir="ltr"
                    placeholder="••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    className="w-full min-h-[42px] rounded-xl border border-[#E2DDD3] bg-white pr-3 pl-10 py-2 text-sm font-mono focus:border-gold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-navy p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2.5 text-xs font-medium text-rose-800 flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[44px] rounded-xl bg-gold hover:bg-gold-hover disabled:opacity-65 text-navy py-2.5 px-4 text-sm font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{loading ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
              </button>
            </form>
          )}

          <div className="pt-2 border-t border-[#EFECE5] text-center">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setAuthMode((m) => (m === 'pin' ? 'supabase' : 'pin'));
              }}
              className="text-xs font-medium text-ink-muted hover:text-navy transition-colors cursor-pointer"
            >
              {authMode === 'pin'
                ? 'أو التحقق عبر حساب المسؤول (Supabase)'
                : 'العودة لإدخال الرمز السري (PIN)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
