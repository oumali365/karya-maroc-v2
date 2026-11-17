import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Wallet,
  Building2,
  Loader2,
  LogOut,
  CarFront,
  Plus,
  Trash2,
  Upload,
  KeyRound,
  MessageCircle,
  ArrowRightLeft,
  AlertTriangle,
} from 'lucide-react';
import { supabase, formatDH, getCityLabelAr } from '../lib/supabase';
import {
  getAdminSessionPin,
  logoutAdminAccess,
  verifyAdminAccess,
} from '../lib/adminAuth';
import { compressImageFile, formatFileSize } from '../lib/imageCompression';
import {
  MAX_CATALOG_CARS,
  STARTER_CATALOG,
  mapCatalogRow,
} from '../data/starterData';
import type {
  AdminReassignCarOption,
  AgencyBookingRecord,
  AgencyProfile,
  CatalogCar,
  FuelType,
  PayoutRecord,
  TransmissionType,
} from '../types/karya';

interface AdminConsoleProps {
  onUnauthorized: () => void;
  onLogout?: () => void;
}

const KNOWN_ECONOMIC_BRANDS = [
  'Dacia',
  'Renault',
  'Peugeot',
  'Ford',
  'Hyundai',
  'Citroën',
  'Fiat',
  'Volkswagen',
  'Kia',
  'Opel',
  'Toyota',
];

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onUnauthorized, onLogout }) => {
  const [tab, setTab] = useState<'receipts' | 'payouts' | 'agencies' | 'catalog'>('receipts');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [bookings, setBookings] = useState<AgencyBookingRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [agencies, setAgencies] = useState<AgencyProfile[]>([]);
  const [catalog, setCatalog] = useState<CatalogCar[]>([]);
  const [availableCars, setAvailableCars] = useState<AdminReassignCarOption[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reassignBookingId, setReassignBookingId] = useState<string | null>(null);
  const [reassignTargetCarId, setReassignTargetCarId] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignFeedback, setReassignFeedback] = useState<string | null>(null);
  const [resetAgencyId, setResetAgencyId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');
  const [resettingPin, setResettingPin] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

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
      const adminPin = getAdminSessionPin();

      // Primary: Unified SECURITY DEFINER RPC (works for both Admin PIN & Supabase Auth)
      const { data: dashData, error: dashErr } = await supabase.rpc('admin_get_dashboard_data', {
        p_admin_pin: adminPin,
      });

      if (!dashErr && dashData && typeof dashData === 'object') {
        const payload = dashData as Record<string, any[]>;
        setBookings((payload.bookings || []) as AgencyBookingRecord[]);
        setPayouts((payload.payouts || []) as PayoutRecord[]);
        setAgencies((payload.agencies || []) as AgencyProfile[]);
        setAvailableCars((payload.available_cars || []) as AdminReassignCarOption[]);
        setCatalog(
          Array.isArray(payload.catalog) && payload.catalog.length > 0
            ? payload.catalog.map((r) => mapCatalogRow(r))
            : STARTER_CATALOG,
        );
        setLoading(false);
        return;
      }

      // Fallback direct table queries if admin logged in via Supabase Auth or schema RPC isn't updated yet
      const [bRes, pRes, aRes, cRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, agencies(name), agency_cars(brand, model)')
          .order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('*').order('created_at', { ascending: false }),
        supabase.from('car_catalog').select('*').order('brand', { ascending: true }),
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
      setCatalog(
        !cRes.error && Array.isArray(cRes.data) && cRes.data.length > 0
          ? cRes.data.map((r) => mapCatalogRow(r as Record<string, any>))
          : STARTER_CATALOG,
      );
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
    const adminPin = getAdminSessionPin();
    const { error } = await supabase.rpc('admin_verify_payment', {
      p_booking_id: bookingId,
      p_admin_pin: adminPin,
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    loadAdminData();
  };

  const handleMarkPayoutSent = async (payoutId: string) => {
    const adminPin = getAdminSessionPin();
    const { error } = await supabase.rpc('admin_mark_payout_sent', {
      p_payout_id: payoutId,
      p_admin_pin: adminPin,
    });
    if (error) {
      await supabase
        .from('payouts')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', payoutId);
    }
    loadAdminData();
  };

  const handleVerifyAgency = async (agencyId: string, status: 'verified' | 'suspended') => {
    const adminPin = getAdminSessionPin();
    const { error } = await supabase.rpc('admin_verify_agency', {
      p_agency_id: agencyId,
      p_status: status,
      p_admin_pin: adminPin,
    });
    if (error) {
      await supabase.from('agencies').update({ verification_status: status }).eq('id', agencyId);
    }
    loadAdminData();
  };

  const handleResetAgencyPin = async (e: React.FormEvent, ag: AgencyProfile) => {
    e.preventDefault();
    setResetError(null);
    setResetFeedback(null);

    const cleanPin = resetPinValue.trim();
    if (cleanPin.length < 4) {
      setResetError('الرمز السري المؤقت يجب أن يتكون من 4 أرقام أو رموز على الأقل.');
      return;
    }

    setResettingPin(true);
    try {
      const adminPin = getAdminSessionPin();
      const { error } = await supabase.rpc('admin_reset_agency_pin', {
        p_agency_id: ag.id,
        p_new_pin: cleanPin,
        p_admin_pin: adminPin,
      });
      if (error) throw new Error(error.message);

      setResetFeedback(
        `تم تعيين رمز سري مؤقت للوكالة "${ag.name}" (${ag.phone}): ${cleanPin} — يرجى إبلاغ صاحب الوكالة لتغييره بعد الدخول.`,
      );
      setResetAgencyId(null);
      setResetPinValue('');
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'تعذر إعادة تعيين الرمز السري.');
    } finally {
      setResettingPin(false);
    }
  };

  const handleReassignBooking = async (e: React.FormEvent, bookingId: string) => {
    e.preventDefault();
    if (!reassignTargetCarId) return;

    setReassigning(true);
    setErrorMsg(null);
    setReassignFeedback(null);
    try {
      const adminPin = getAdminSessionPin();
      const { error } = await supabase.rpc('admin_reassign_booking', {
        p_booking_id: bookingId,
        p_target_car_id: reassignTargetCarId,
        p_admin_pin: adminPin,
      });
      if (error) throw new Error(error.message);

      setReassignFeedback('تم تحويل الطلب إلى الوكالة البديلة بنجاح. يمكنك الآن إشعار الوكالة الجديدة عبر واتساب.');
      setReassignBookingId(null);
      setReassignTargetCarId('');
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر تحويل الطلب للوكالة البديلة.');
    } finally {
      setReassigning(false);
    }
  };

  const buildAgencyWhatsAppUrl = (b: AgencyBookingRecord): string | null => {
    const rawPhone = (b.agency_phone || '').replace(/[^0-9]/g, '');
    if (!rawPhone) return null;

    let waPhone = rawPhone;
    if (waPhone.startsWith('00')) waPhone = waPhone.slice(2);
    else if (waPhone.startsWith('0')) waPhone = `212${waPhone.slice(1)}`;
    else if (!waPhone.startsWith('212')) waPhone = `212${waPhone}`;

    const formattedDate = (() => {
      const dt = new Date(b.delivery_at);
      return Number.isNaN(dt.getTime())
        ? b.delivery_at
        : dt.toLocaleDateString('ar-MA', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    })();

    const lines = [
      `السلام عليكم وكالة ${b.agency_name || ''}،`,
      `لديكم حجز مؤكد من منصة كراء بدون ضمان (0 DH):`,
      `• رمز الحجز: ${b.booking_code}`,
      `• السيارة: ${b.car_brand || ''} ${b.car_model || ''}`.trim(),
      `• المدة: ${b.days} أيام | موعد الاستلام: ${formattedDate}`,
      b.pickup_location ? `• مكان الاستلام: ${b.pickup_location}` : '',
      `• العميل: ${b.customer_name} | الهاتف: ${b.customer_phone}`,
      `• البطاقة الوطنية: ${b.customer_cin}${b.customer_license_number ? ` | الرخصة: ${b.customer_license_number}` : ''}`,
      `• المبلغ المستخلص عند التسليم (90%): ${formatDH(Number(b.agency_payout_amount))}`,
      `ملاحظة: يرجى طلب رمز التسليم السري (4 أرقام) من العميل وإدخاله في بوابة الوكالات عند تسليم المفاتيح.`,
    ]
      .filter(Boolean)
      .join('\n');

    return `https://wa.me/${waPhone}?text=${encodeURIComponent(lines)}`;
  };

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text.replace(/\s+/g, ''));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2563EB]" />
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
            تأكيد وصولات التسبيق، متابعة الاسترجاع، توثيق الوكالات، وإدارة الكتالوج المركزي.
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
          <div className="text-xs text-slate-500">الكتالوج المركزي للسيارات</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-slate-900 mt-1">
            {catalog.length} / {MAX_CATALOG_CARS}
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
          <span>الاسترجاع ({pendingPayoutsCount})</span>
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

        <button
          type="button"
          onClick={() => setTab('catalog')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'catalog' ? 'bg-[#2563EB] text-white' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <CarFront className="w-3.5 h-3.5" />
          <span>الكتالوج ({catalog.length})</span>
        </button>
      </div>

      {tab === 'receipts' && (
        <div className="space-y-4">
          {reassignFeedback && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs sm:text-sm text-emerald-800 flex items-center justify-between gap-3">
              <span>{reassignFeedback}</span>
              <button
                type="button"
                onClick={() => setReassignFeedback(null)}
                className="text-xs font-bold text-emerald-700 shrink-0"
              >
                إغلاق
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            {bookings.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                لا توجد طلبات بانتظار المراجعة حالياً.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bookings.map((b) => {
                  const statusMeta = getBookingStatusMeta(b.status);
                  const waUrl = buildAgencyWhatsAppUrl(b);
                  const candidateCars = availableCars
                    .filter((c) => c.agency_id !== b.agency_id)
                    .sort((a, c2) => {
                      const sameCityA =
                        b.car_city && a.city.toLowerCase() === b.car_city.toLowerCase() ? 0 : 1;
                      const sameCityB =
                        b.car_city && c2.city.toLowerCase() === b.car_city.toLowerCase() ? 0 : 1;
                      if (sameCityA !== sameCityB) return sameCityA - sameCityB;
                      return a.daily_price - c2.daily_price;
                    });
                  const canReassign =
                    b.status === 'payment_uploaded' ||
                    b.status === 'payment_verified' ||
                    b.status === 'refund_requested';

                  return (
                    <div
                      key={b.id}
                      className={`p-4 space-y-3 transition-colors ${
                        b.agency_ack_status === 'unavailable'
                          ? 'bg-red-50/40'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular font-bold text-slate-900">
                              {b.booking_code}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="font-semibold text-slate-800">
                              {b.car_brand} {b.car_model}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span className="text-xs text-slate-600 font-medium">
                              {b.agency_name}
                              {b.agency_phone ? ` (${b.agency_phone})` : ''}
                            </span>
                            {b.reassigned_at && (
                              <span className="rounded-full bg-blue-100 text-[#2563EB] px-2 py-0.5 text-[11px] font-bold">
                                تم تحويله لوكالة بديلة
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                              العميل: <strong className="text-slate-900">{b.customer_name}</strong>{' '}
                              (<span dir="ltr" className="font-mono">{b.customer_phone}</span>)
                            </span>
                            <span>·</span>
                            <span>
                              البنك: <span className="font-bold">{b.selected_bank_code || 'غير محدد'}</span>
                            </span>
                            <span>·</span>
                            <span>
                              التسبيق (10%):{' '}
                              <span className="font-mono-tabular font-bold text-[#2563EB]">
                                {formatDH(Number(b.commission_amount))}
                              </span>
                            </span>
                            <span>·</span>
                            <span>
                              للوكالة (90%):{' '}
                              <span className="font-mono-tabular font-bold text-slate-800">
                                {formatDH(Number(b.agency_payout_amount))}
                              </span>
                            </span>
                            {b.handover_pin && (
                              <>
                                <span>·</span>
                                <span>
                                  رمز التسليم: <span className="font-mono font-bold">{b.handover_pin}</span>
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`font-semibold px-2 py-0.5 rounded-md ${
                                b.agency_ack_status === 'available'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : b.agency_ack_status === 'unavailable'
                                    ? 'bg-red-100 text-red-800 border border-red-200 font-bold'
                                    : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {b.agency_ack_status === 'available'
                                ? 'الوكالة أكدت توفر السيارة'
                                : b.agency_ack_status === 'unavailable'
                                  ? 'الوكالة اعتذرت: غير متوفرة (يُرجى التحويل!)'
                                  : 'بانتظار رد الوكالة على التوفر'}
                            </span>

                            {b.dispute_flag && (
                              <span className="bg-red-100 text-red-800 border border-red-200 px-2 py-0.5 rounded-md font-bold">
                                تبليغ الوكالة:{' '}
                                {b.dispute_flag === 'invalid_license'
                                  ? 'رخصة < سنتين'
                                  : 'تغيب العميل'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>

                          {b.status === 'payment_uploaded' && (
                            <button
                              type="button"
                              onClick={() => handleVerifyPayment(b.id)}
                              className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-3.5 py-2 text-xs font-bold transition-colors"
                            >
                              تأكيد الاستلام
                            </button>
                          )}

                          {waUrl && (b.status === 'payment_verified' || b.status === 'payment_uploaded') && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>إشعار الوكالة واتساب</span>
                            </a>
                          )}

                          {canReassign && (
                            <button
                              type="button"
                              onClick={() => {
                                if (reassignBookingId === b.id) {
                                  setReassignBookingId(null);
                                  setReassignTargetCarId('');
                                } else {
                                  setReassignBookingId(b.id);
                                  setReassignTargetCarId(candidateCars[0]?.car_id || '');
                                }
                              }}
                              className={`rounded-xl px-3 py-2 text-xs font-bold border transition-colors inline-flex items-center gap-1.5 ${
                                b.agency_ack_status === 'unavailable'
                                  ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white'
                                  : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                              }`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>تحويل لوكالة أخرى</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {reassignBookingId === b.id && (
                        <form
                          onSubmit={(e) => handleReassignBooking(e, b.id)}
                          className="rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 space-y-2.5"
                        >
                          <div className="text-xs font-bold text-slate-800">
                            تحويل الطلب {b.booking_code} إلى وكالة بديلة موثقة ({getCityLabelAr(b.car_city || '')})
                          </div>
                          {candidateCars.length === 0 ? (
                            <div className="text-xs text-red-700">
                              لا توجد حالياً سيارات متاحة لدى وكالات أخرى موثقة لإتمام التحويل.
                            </div>
                          ) : (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <select
                                required
                                value={reassignTargetCarId}
                                onChange={(e) => setReassignTargetCarId(e.target.value)}
                                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold focus:border-[#2563EB] focus:outline-none"
                              >
                                {candidateCars.map((c) => (
                                  <option key={c.car_id} value={c.car_id}>
                                    {c.agency_name} ({getCityLabelAr(c.city)}) — {c.brand} {c.model} ({c.daily_price} DH/يوم) · {c.agency_phone}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="submit"
                                disabled={reassigning}
                                className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                              >
                                {reassigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>تأكيد التحويل الآن</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setReassignBookingId(null);
                                  setReassignTargetCarId('');
                                }}
                                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                              >
                                إلغاء
                              </button>
                            </div>
                          )}
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
        <div className="space-y-4">
          {resetFeedback && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs sm:text-sm text-emerald-800 flex items-center justify-between gap-3">
              <span>{resetFeedback}</span>
              <button
                type="button"
                onClick={() => setResetFeedback(null)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 shrink-0"
              >
                إغلاق
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden">
            {agencies.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                لا توجد وكالات مسجلة للمراجعة حالياً.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {agencies.map((ag) => (
                  <div
                    key={ag.id}
                    className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
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
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>
                            الهاتف: <span dir="ltr" className="font-mono text-slate-800">{ag.phone}</span>
                          </span>
                          <span>·</span>
                          <span className={ag.terms_accepted_at ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                            {ag.terms_accepted_at
                              ? 'موافق على: بدون ضمان (0 DH) + عمولة 10%'
                              : 'إقرار قديم'}
                          </span>
                          {(ag.strike_count ?? 0) > 0 && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                                <AlertTriangle className="w-3 h-3" />
                                <span>عدم توفر / تحويل: {ag.strike_count}</span>
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (resetAgencyId === ag.id) {
                              setResetAgencyId(null);
                              setResetPinValue('');
                              setResetError(null);
                            } else {
                              setResetAgencyId(ag.id);
                              setResetPinValue('');
                              setResetError(null);
                            }
                          }}
                          className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[#2563EB]" />
                          <span>إعادة تعيين الرمز</span>
                        </button>
                        {ag.verification_status !== 'verified' ? (
                          <button
                            type="button"
                            onClick={() => handleVerifyAgency(ag.id, 'verified')}
                            className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-4 py-2 text-xs font-bold transition-colors"
                          >
                            توثيق الوكالة
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

                    {resetAgencyId === ag.id && (
                      <form
                        onSubmit={(e) => handleResetAgencyPin(e, ag)}
                        className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 space-y-2.5"
                      >
                        <div className="text-xs font-semibold text-slate-800">
                          إدخال رمز سري مؤقت جديد للوكالة ({ag.phone})
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            required
                            minLength={4}
                            dir="ltr"
                            placeholder="مثال: 4820"
                            value={resetPinValue}
                            onChange={(e) => setResetPinValue(e.target.value)}
                            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono focus:border-[#2563EB] focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={resettingPin}
                            className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-4 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
                          >
                            {resettingPin && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>حفظ الرمز المؤقت</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetAgencyId(null);
                              setResetPinValue('');
                              setResetError(null);
                            }}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
                          >
                            إلغاء
                          </button>
                        </div>
                        {resetError && (
                          <div className="text-xs text-red-700">{resetError}</div>
                        )}
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'catalog' && (
        <AdminCatalogManager catalog={catalog} onRefresh={loadAdminData} />
      )}
    </section>
  );
};

/* ============================================================================
   CENTRAL ECONOMIC CAR CATALOG MANAGER (ADMIN ONLY, MAX 50 MODELS)
   ============================================================================ */
const AdminCatalogManager: React.FC<{
  catalog: CatalogCar[];
  onRefresh: () => void;
}> = ({ catalog, onRefresh }) => {
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [brand, setBrand] = useState('Dacia');
  const [model, setModel] = useState('');
  const [category, setCategory] = useState('Économique');
  const [seats, setSeats] = useState(5);
  const [defaultFuel, setDefaultFuel] = useState<FuelType>('diesel');
  const [defaultTransmission, setDefaultTransmission] =
    useState<TransmissionType>('manual');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const brands = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.brand))).sort(),
    [catalog],
  );

  const filtered = useMemo(
    () => (brandFilter === 'all' ? catalog : catalog.filter((c) => c.brand === brandFilter)),
    [catalog, brandFilter],
  );

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setCompressing(true);
    setErrorMsg(null);
    setFeedback(null);

    try {
      const result = await compressImageFile(rawFile, {
        maxWidth: 1280,
        maxHeight: 960,
        quality: 0.8,
      });
      setImageFile(result.file);
      setImagePreview(URL.createObjectURL(result.file));
      setFeedback(`تم تجهيز الصورة (${formatFileSize(result.compressedBytes)})`);
    } finally {
      setCompressing(false);
    }
  };

  const handleAddModel = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedback(null);

    if (catalog.length >= MAX_CATALOG_CARS) {
      setErrorMsg(`تم بلوغ الحد الأقصى (${MAX_CATALOG_CARS} سيارة). احذف موديلاً لإضافة آخر.`);
      return;
    }

    if (!brand.trim() || !model.trim()) {
      setErrorMsg('يرجى تحديد الماركة واسم الموديل.');
      return;
    }

    setSaving(true);
    try {
      let finalUrl = imageUrlInput.trim();

      if (imageFile) {
        const ext = imageFile.name.split('.').pop() || 'jpg';
        const objectPath = `catalog/${brand.trim().toLowerCase()}-${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('car-photos')
          .upload(objectPath, imageFile, { upsert: true });

        if (uploadErr) {
          throw new Error(`تعذر رفع الصورة للتخزين السحابي: ${uploadErr.message}`);
        }
        const { data: pubData } = supabase.storage.from('car-photos').getPublicUrl(objectPath);
        finalUrl = pubData.publicUrl;
      }

      const { error } = await supabase.rpc('admin_upsert_catalog_car', {
        p_brand: brand.trim(),
        p_model: model.trim(),
        p_category: category,
        p_seats: seats,
        p_default_fuel: defaultFuel,
        p_default_transmission: defaultTransmission,
        p_image_url: finalUrl || null,
        p_admin_pin: getAdminSessionPin(),
      });

      if (error) throw new Error(error.message);

      setModel('');
      setImageFile(null);
      setImagePreview(null);
      setImageUrlInput('');
      setFeedback('تمت إضافة الموديل إلى الكتالوج المركزي بنجاح.');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ الموديل في الكتالوج.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModel = async (item: CatalogCar) => {
    setErrorMsg(null);
    const { error } = await supabase.rpc('admin_delete_catalog_car', {
      p_catalog_id: item.id,
      p_admin_pin: getAdminSessionPin(),
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {/* Add Catalog Model Form */}
      <form
        onSubmit={handleAddModel}
        className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-slate-900">إضافة سيارة اقتصادية للكتالوج المركزي</h2>
            <p className="text-xs text-slate-500">
              الكتالوج يضم من 30 إلى {MAX_CATALOG_CARS} صورة عالية الجودة تختار منها الوكالات سياراتها
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-bold text-[#2563EB]">
            {catalog.length} / {MAX_CATALOG_CARS}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الشركة (Brand)</label>
            <input
              required
              list="known-economic-brands"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Dacia, Renault, Peugeot..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <datalist id="known-economic-brands">
              {KNOWN_ECONOMIC_BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الموديل (Model)</label>
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Sandero Stepway, Clio 5..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الفئة</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="Économique">اقتصادية (Économique)</option>
              <option value="Citadine">مدينية صغيرة (Citadine)</option>
              <option value="SUV Économique">SUV اقتصادية</option>
              <option value="Berline Économique">سيدان اقتصادية</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">المقاعد</label>
            <input
              type="number"
              min={2}
              max={9}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono-tabular"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">الوقود الافتراضي</label>
            <select
              value={defaultFuel}
              onChange={(e) => setDefaultFuel(e.target.value as FuelType)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="diesel">ديزل</option>
              <option value="essence">بنزين</option>
              <option value="hybrid">هجين</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">ناقل الحركة</label>
            <select
              value={defaultTransmission}
              onChange={(e) => setDefaultTransmission(e.target.value as TransmissionType)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
            >
              <option value="manual">يدوي</option>
              <option value="automatic">أوتوماتيك</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              صورة الموديل (رفع صورة أو رابط URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                dir="ltr"
                placeholder="https://... (اختياري إذا تم رفع ملف)"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                disabled={compressing}
                onClick={() => fileRef.current?.click()}
                className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{imagePreview ? 'تغيير الصورة' : 'رفع صورة'}</span>
              </button>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {errorMsg}
          </div>
        )}
        {feedback && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-800">
            {feedback}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || compressing || catalog.length >= MAX_CATALOG_CARS}
            className="rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white px-5 py-2.5 text-xs font-bold flex items-center gap-1.5"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>إضافة للكتالوج</span>
          </button>
        </div>
      </form>

      {/* Catalog Grid Grouped/Filtered by Brand */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setBrandFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
              brandFilter === 'all'
                ? 'bg-[#2563EB] text-white'
                : 'bg-white border border-slate-200 text-slate-700'
            }`}
          >
            كل الشركات ({catalog.length})
          </button>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrandFilter(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap ${
                brandFilter === b
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-slate-100">
                <img
                  src={item.image_url}
                  alt={`${item.brand} ${item.model}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {item.brand} {item.model}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {item.category} · {item.seats} مقاعد
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteModel(item)}
                  aria-label={`حذف ${item.brand} ${item.model}`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
