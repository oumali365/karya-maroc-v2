import React, { useEffect, useState } from 'react';
import { CheckCircle2, Copy, Check, Shield, Wallet, Building2, Loader2 } from 'lucide-react';
import { supabase, formatDH, getCityLabelAr } from '../lib/supabase';
import { verifyAdminAccess } from '../lib/adminAuth';
import type { AgencyBookingRecord, AgencyProfile, PayoutRecord } from '../types/karya';

interface AdminConsoleProps {
  onUnauthorized: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onUnauthorized }) => {
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
      const { isAdmin } = await verifyAdminAccess();
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

      if (bRes.error) throw new Error(bRes.error.message);
      if (pRes.error) throw new Error(pRes.error.message);
      if (aRes.error) throw new Error(aRes.error.message);

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

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">لوحة إدارة الوساطة والعربون</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            مراجعة وصولات العربون (10%) وتأكيد الحجوزات، ومعالجة طلبات الاسترجاع للعميل خلال 24 إلى 48 ساعة
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-left">
          <div className="text-xs text-slate-500">عائدات المنصة المؤكدة (عربون 10%)</div>
          <div className="font-mono-tabular font-extrabold text-lg text-[#1B5E20]">
            {formatDH(totalCommission)}
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl self-start w-fit">
        <button
          type="button"
          onClick={() => setTab('receipts')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'receipts' ? 'bg-[#1B5E20] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>مراجعة وصولات العربون ({bookings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('payouts')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'payouts' ? 'bg-[#1B5E20] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>طلبات استرجاع العربون ({payouts.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('agencies')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'agencies' ? 'bg-[#1B5E20] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>توثيق الشركات ({agencies.length})</span>
        </button>
      </div>

      {tab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          {bookings.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              لا توجد طلبات بانتظار المراجعة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono-tabular font-bold text-slate-900">
                        {b.booking_code}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="font-semibold text-slate-800">
                        {b.car_brand} {b.car_model}
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-xs text-slate-500">{b.agency_name}</span>
                    </div>
                    <div className="text-xs text-slate-600">
                      البنك: <span className="font-bold">{b.selected_bank_code || 'غير محدد'}</span> ·
                      الإجمالي:{' '}
                      <span className="font-mono-tabular font-bold text-slate-900">
                        {formatDH(Number(b.total_amount))}
                      </span>{' '}
                      · عمولة 10%:{' '}
                      <span className="font-mono-tabular font-bold text-emerald-700">
                        {formatDH(Number(b.commission_amount))}
                      </span>{' '}
                      · للوكالة 90%:{' '}
                      <span className="font-mono-tabular font-bold text-[#1B5E20]">
                        {formatDH(Number(b.agency_payout_amount))}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-600 px-2.5 py-1 rounded-lg bg-slate-100">
                      {b.status}
                    </span>
                    {b.status === 'payment_uploaded' && (
                      <button
                        type="button"
                        onClick={() => handleVerifyPayment(b.id)}
                        className="rounded-xl bg-[#1B5E20] hover:bg-[#144718] text-white px-4 py-2 text-xs font-bold"
                      >
                        تأكيد استلام العربون
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              لا توجد طلبات استرجاع عربون مسجلة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">استرجاع العربون للعميل</span>
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
                        className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline"
                      >
                        {copiedId === p.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === p.id ? 'نُسخ' : 'نسخ RIB'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono-tabular font-bold text-base text-[#1B5E20]">
                      {formatDH(Number(p.amount))}
                    </span>
                    {p.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPayoutSent(p.id)}
                        className="rounded-xl bg-[#1B5E20] text-white px-3.5 py-2 text-xs font-bold"
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
        <div className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden">
          {agencies.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              لا توجد شركات مسجلة للمراجعة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {agencies.map((ag) => (
                <div
                  key={ag.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="font-bold text-slate-900">
                      {ag.name} · {getCityLabelAr(ag.city)}
                    </div>
                    <div className="text-xs text-slate-500">
                      الهاتف: <span dir="ltr">{ag.phone}</span> · البنك: {ag.bank_name} · RIB:{' '}
                      <span dir="ltr" className="font-mono">
                        {ag.bank_rib}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {ag.verification_status !== 'verified' ? (
                      <button
                        type="button"
                        onClick={() => handleVerifyAgency(ag.id, 'verified')}
                        className="rounded-xl bg-emerald-600 text-white px-4 py-2 text-xs font-bold"
                      >
                        توثيق الشركة
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVerifyAgency(ag.id, 'suspended')}
                        className="rounded-xl border border-slate-200 text-slate-600 px-3 py-1.5 text-xs font-semibold"
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
