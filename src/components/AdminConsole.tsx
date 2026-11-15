import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Check, Shield, Wallet, Building2, Loader2, LogOut } from 'lucide-react';
import { supabase, formatDH, getCityLabelAr } from '../lib/supabase';
import { logoutAdminAccess, verifyAdminAccess } from '../lib/adminAuth';
import type { AgencyBookingRecord, AgencyProfile, PayoutRecord } from '../types/karya';

interface AdminConsoleProps {
  onUnauthorized: () => void;
  onLogout?: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onUnauthorized, onLogout }) => {
  const [tab, setTab] = useState<'receipts' | 'payouts' | 'agencies'>('receipts');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [bookings, setBookings] = useState<AgencyBookingRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [agencies, setAgencies] = useState<AgencyProfile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { isAdmin, mode } = await verifyAdminAccess();
      if (!isAdmin) {
        setAuthorized(false);
        onUnauthorized();
        return;
      }

      setAuthorized(true);

      const [bRes, pRes, aRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, agencies(name), agency_cars(brand, model)')
          .order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('*').order('created_at', { ascending: false }),
      ]);

      if (bRes.error && mode === 'supabase') throw new Error(bRes.error.message);
      if (pRes.error && mode === 'supabase') throw new Error(pRes.error.message);
      if (aRes.error && mode === 'supabase') throw new Error(aRes.error.message);

      setBookings(
        (bRes.data || []).map((r: Record<string, any>) => ({
          ...r,
          agency_name: r.agencies?.name,
          car_brand: r.agency_cars?.brand,
          car_model: r.agency_cars?.model,
        })) as AgencyBookingRecord[],
      );
      setPayouts((pRes.data || []) as PayoutRecord[]);
      setAgencies((aRes.data || []) as AgencyProfile[]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحميل بيانات الإدارة من قاعدة البيانات.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleVerifyPayment = async (bookingId: string) => {
    await supabase.rpc('admin_verify_payment', { p_booking_id: bookingId });
    loadAdminData();
  };

  const handleMarkPayoutSent = async (payoutId: string) => {
    await supabase
      .from('payouts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', payoutId);
    loadAdminData();
  };

  const handleVerifyAgency = async (agencyId: string, status: 'verified' | 'suspended') => {
    await supabase.from('agencies').update({ verification_status: status }).eq('id', agencyId);
    loadAdminData();
  };

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text.replace(/\s+/g, ''));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const totalCommission = bookings
    .filter((b) => ['payment_verified', 'car_delivered', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.commission_amount || 0), 0);

  const pendingReceiptsCount = bookings.filter((b) => b.status === 'payment_uploaded').length;
  const pendingPayoutsCount = payouts.filter((p) => p.status === 'pending').length;

  const getBookingStatusMeta = (status: string) => {
    switch (status) {
      case 'payment_uploaded':
        return { label: 'بانتظار التحقق', cls: 'text-amber-700' };
      case 'payment_verified':
        return { label: 'مؤكد', cls: 'text-emerald-700' };
      case 'car_delivered':
      case 'completed':
        return { label: 'تم التسليم', cls: 'text-slate-700' };
      case 'refund_requested':
        return { label: 'طلب استرجاع', cls: 'text-red-700' };
      case 'refunded':
      case 'cancelled':
        return { label: 'مسترجع / ملغى', cls: 'text-red-700' };
      default:
        return { label: 'بانتظار الدفع', cls: 'text-slate-500' };
    }
  };

  const handleLogout = async () => {
    await logoutAdminAccess();
    if (onLogout) {
      onLogout();
    } else {
      onUnauthorized();
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-0.5">الإدارة / مراجعة العمليات</div>
          <h1 className="text-2xl font-bold text-slate-900">لوحة إدارة الوساطة</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            تأكيد وصولات التسبيق، متابعة الاسترجاع الفوري، وتوثيق الوكالات.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="self-start sm:self-auto rounded-xl border border-slate-200 bg-white hover:bg-red-50 hover:border-red-200 text-slate-600 hover:text-red-700 px-3.5 py-2 text-xs font-bold transition-colors flex items-center gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          <span>قفل الإدارة</span>
        </button>
      </div>

      {/* 3-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="text-xs text-slate-500">عائدات المنصة المؤكدة (10%)</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-[#2563EB] mt-1">
            {formatDH(totalCommission)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="text-xs text-slate-500">وصولات بانتظار المراجعة</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-slate-900 mt-1">
            {pendingReceiptsCount}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5">
          <div className="text-xs text-slate-500">طلبات استرجاع معلقة</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-slate-900 mt-1">
            {pendingPayoutsCount}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Segmented Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200/80 rounded-xl self-start w-fit">
        <button
          type="button"
          onClick={() => setTab('receipts')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'receipts' ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>الوصولات ({bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('payouts')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'payouts' ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>الاسترجاع ({payouts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('agencies')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'agencies' ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>الوكالات ({agencies.length})</span>
        </button>
      </div>

      {tab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          {bookings.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              لا توجد طلبات بانتظار المراجعة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bookings.map((b) => {
                const statusMeta = getBookingStatusMeta(b.status);
                return (
                  <div
                    key={b.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-tabular font-bold text-slate-900">
                          {b.booking_code}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-800">
                          {b.car_brand} {b.car_model}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs text-slate-500">{b.agency_name}</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        البنك: <span className="font-bold">{b.selected_bank_code || 'غير محدد'}</span> ·
                        الإجمالي:{' '}
                        <span className="font-mono-tabular font-bold text-slate-900">
                          {formatDH(Number(b.total_amount))}
                        </span>{' '}
                        · التسبيق (10%):{' '}
                        <span className="font-mono-tabular font-bold text-[#2563EB]">
                          {formatDH(Number(b.commission_amount))}
                        </span>{' '}
                        · للوكالة (90%):{' '}
                        <span className="font-mono-tabular font-bold text-slate-800">
                          {formatDH(Number(b.agency_payout_amount))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-bold ${statusMeta.cls}`}>
                        {statusMeta.label}
                      </span>
                      {b.status === 'payment_uploaded' && (
                        <button
                          type="button"
                          onClick={() => handleVerifyPayment(b.id)}
                          className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition-colors"
                        >
                          تأكيد الاستلام
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              لا توجد طلبات استرجاع تسبيق مسجلة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">استرجاع التسبيق للعميل</span>
                      <span className="text-slate-400">·</span>
                      <span className="text-sm text-slate-700">{p.recipient_name}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                      <span>{p.recipient_bank}</span>
                      <span dir="ltr" className="font-mono text-slate-800">
                        {p.recipient_rib}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(p.id, p.recipient_rib)}
                        className="inline-flex items-center gap-1 text-[#2563EB] font-semibold hover:underline"
                      >
                        {copiedId === p.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === p.id ? 'نُسخ' : 'نسخ الحساب / الهاتف'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular font-bold text-base text-[#2563EB]">
                      {formatDH(Number(p.amount))}
                    </span>
                    {p.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPayoutSent(p.id)}
                        className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3.5 py-2 text-xs font-bold transition-colors"
                      >
                        تأكيد إرسال الاسترجاع
                      </button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم التحويل</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'agencies' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
          {agencies.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              لا توجد شركات مسجلة للمراجعة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agencies.map((ag) => (
                <div
                  key={ag.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">
                        {ag.name} · {getCityLabelAr(ag.city)}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          ag.verification_status === 'verified'
                            ? 'text-emerald-700'
                            : ag.verification_status === 'suspended'
                              ? 'text-red-600'
                              : 'text-amber-700'
                        }`}
                      >
                        {ag.verification_status === 'verified'
                          ? 'موثقة'
                          : ag.verification_status === 'suspended'
                            ? 'موقوفة'
                            : 'قيد المراجعة'}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      الهاتف: <span dir="ltr">{ag.phone}</span> · البنك: {ag.bank_name} · RIB:{' '}
                      <span dir="ltr" className="font-mono">
                        {ag.bank_rib}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ag.verification_status !== 'verified' ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyAgency(ag.id, 'verified')}
                        className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition-colors"
                      >
                        توثيق الشركة
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVerifyAgency(ag.id, 'suspended')}
                        className="rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 px-3 py-1.5 text-xs font-semibold transition-colors"
                      >
                        إيقاف مؤقت
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
