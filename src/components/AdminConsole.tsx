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
  FileText,
  X,
} from 'lucide-react';
import { supabase, formatDH, getCityLabelAr } from '../lib/supabase';
import {
  getAdminSessionPin,
  logoutAdminAccess,
  verifyAdminAccess,
} from '../lib/adminAuth';
import { compressImageFile, formatFileSize } from '../lib/imageCompression';
import {
  KNOWN_ECONOMIC_BRANDS,
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
  const [bookingFilter, setBookingFilter] = useState<'all' | 'pending' | 'unavailable' | 'verified'>('all');
  const [receiptPreview, setReceiptPreview] = useState<{
    bookingCode: string;
    url: string;
    isPdf: boolean;
  } | null>(null);

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

  const handleAllowRefund = async (bookingId: string) => {
    setErrorMsg(null);
    const adminPin = getAdminSessionPin();
    const { error } = await supabase.rpc('admin_allow_refund', {
      p_booking_id: bookingId,
      p_admin_pin: adminPin,
    });
    if (error) {
      setErrorMsg(error.message);
      return;
    }
    setReassignFeedback('تم فتح خيار طلب الاسترجاع للعميل في صفحة "حجوزاتي".');
    await loadAdminData();
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
      `لديكم حجز مؤكد من منصة Karya (بدون ضمانة مالية):`,
      `• رمز الحجز: ${b.booking_code}`,
      `• السيارة: ${b.car_brand || ''} ${b.car_model || ''}`.trim(),
      `• المدة: ${b.days} أيام | موعد الاستلام: ${formattedDate}`,
      b.pickup_location ? `• مكان الاستلام: ${b.pickup_location}` : '',
      `• العميل: ${b.customer_name} | الهاتف: ${b.customer_phone}`,
      `• البطاقة الوطنية: ${b.customer_cin}${b.customer_license_number ? ` | الرخصة: ${b.customer_license_number}` : ''}`,
      `• المبلغ المتبقي عند التسليم (90%): ${formatDH(Number(b.agency_payout_amount))}`,
      `ملاحظة: يرجى التحقق من البطاقة الوطنية ورخصة السياقة (منذ سنتين+) وتوقيع عقد الكراء الرسمي، ثم تأكيد تسليم السيارة في بوابة الوكالات.`,
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

  const openReceiptPreview = (bookingCode: string, receiptPath?: string | null) => {
    if (!receiptPath || receiptPath.startsWith('local://')) return;
    const isPdf = receiptPath.toLowerCase().endsWith('.pdf');
    let resolvedUrl = receiptPath;
    if (!/^https?:\/\//i.test(receiptPath)) {
      const { data } = supabase.storage.from('payment-receipts').getPublicUrl(receiptPath);
      resolvedUrl = data.publicUrl;
    }
    setReceiptPreview({
      bookingCode,
      url: resolvedUrl,
      isPdf,
    });
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--karya-primary)]" />
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
        return { label: 'تم التسليم', cls: 'text-[var(--karya-primary)]' };
      case 'refund_requested':
        return { label: 'طلب استرجاع', cls: 'text-red-700' };
      case 'refunded':
      case 'cancelled':
        return { label: 'مسترجع / ملغى', cls: 'text-red-700' };
      default:
        return { label: 'بانتظار الدفع', cls: 'text-[var(--karya-text-muted)]' };
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
          <div className="text-xs font-semibold text-[var(--karya-text-muted)] mb-0.5">الإدارة / مراجعة العمليات</div>
          <h1 className="text-2xl font-extrabold text-[var(--karya-primary)]">لوحة إدارة الوساطة</h1>
          <p className="text-xs sm:text-sm text-[var(--karya-text-muted)] mt-0.5">
            تأكيد وصولات الحجز (10%)، متابعة طلبات الاسترجاع، توثيق الوكالات، وإدارة الكتالوج المركزي.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="self-start sm:self-auto min-h-[42px] rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] hover:bg-red-50 hover:border-red-200 text-[var(--karya-text-muted)] hover:text-red-700 px-3.5 py-2 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          <span>قفل الإدارة</span>
        </button>
      </div>

      {/* 3-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--karya-text-muted)]">عائدات المنصة المؤكدة (10%)</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-[var(--karya-action)] mt-1">
            {formatDH(totalCommission)}
          </div>
        </div>
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--karya-text-muted)]">وصولات بانتظار المراجعة</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-[var(--karya-primary)] mt-1">
            {pendingReceiptsCount}
          </div>
        </div>
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-5">
          <div className="text-xs font-semibold text-[var(--karya-text-muted)]">الكتالوج المركزي للسيارات</div>
          <div className="font-mono-tabular font-extrabold text-2xl text-[var(--karya-primary)] mt-1">
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
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[var(--karya-surface)] border border-[var(--karya-border)] rounded-xl self-start w-fit shadow-xs">
        <button
          type="button"
          onClick={() => setTab('receipts')}
          className={`min-h-[40px] px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'receipts'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>الوصولات ({pendingReceiptsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('payouts')}
          className={`min-h-[40px] px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'payouts'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>الاسترجاع ({pendingPayoutsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('agencies')}
          className={`min-h-[40px] px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'agencies'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>الوكالات ({agencies.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('catalog')}
          className={`min-h-[40px] px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
            tab === 'catalog'
              ? 'bg-[var(--karya-primary)] text-white'
              : 'text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
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

          {bookings.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { key: 'all', label: `الكل (${bookings.length})` },
                  { key: 'pending', label: `وصولات للمراجعة (${pendingReceiptsCount})` },
                  {
                    key: 'unavailable',
                    label: `تحتاج تحويل (${bookings.filter((b) => b.agency_ack_status === 'unavailable').length})`,
                  },
                  {
                    key: 'verified',
                    label: `مؤكدة (${bookings.filter((b) => b.status === 'payment_verified').length})`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setBookingFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    bookingFilter === f.key
                      ? 'bg-[var(--karya-primary)] text-white'
                      : 'bg-[var(--karya-surface)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs overflow-hidden">
            {bookings.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--karya-text-muted)]">
                لا توجد طلبات بانتظار المراجعة حالياً.
              </div>
            ) : (
              <div className="divide-y divide-[var(--karya-border)]">
                {bookings
                  .filter((b) => {
                    if (bookingFilter === 'pending') return b.status === 'payment_uploaded';
                    if (bookingFilter === 'unavailable') return b.agency_ack_status === 'unavailable';
                    if (bookingFilter === 'verified') return b.status === 'payment_verified';
                    return true;
                  })
                  .map((b) => {
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
                          : 'hover:bg-[var(--karya-surface-muted)]'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono-tabular font-extrabold text-[var(--karya-primary)]">
                              {b.booking_code}
                            </span>
                            <span className="text-[var(--karya-border)]">·</span>
                            <span className="font-bold text-[var(--karya-text)]">
                              {b.car_brand} {b.car_model}
                            </span>
                            <span className="text-[var(--karya-border)]">·</span>
                            <span className="text-xs text-[var(--karya-text-muted)] font-medium">
                              {b.agency_name}
                              {b.agency_phone ? ` (${b.agency_phone})` : ''}
                            </span>
                            {b.reassigned_at && (
                              <span className="rounded-md bg-[var(--karya-action-soft)] text-[var(--karya-action)] px-2 py-0.5 text-[11px] font-bold">
                                تم تحويله لوكالة بديلة
                              </span>
                            )}
                          </div>

                          <div className="text-xs text-[var(--karya-text-muted)] flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span>
                              العميل: <strong className="text-[var(--karya-primary)]">{b.customer_name}</strong>{' '}
                              (<span dir="ltr" className="font-mono">{b.customer_phone}</span>)
                            </span>
                            <span>·</span>
                            <span>
                              البنك: <span className="font-bold text-[var(--karya-text)]">{b.selected_bank_code || 'غير محدد'}</span>
                            </span>
                            <span>·</span>
                            <span>
                              لتأكيد الحجز (10%):{' '}
                              <span className="font-mono-tabular font-bold text-[var(--karya-action)]">
                                {formatDH(Number(b.commission_amount))}
                              </span>
                            </span>
                            <span>·</span>
                            <span>
                              للوكالة (90%):{' '}
                              <span className="font-mono-tabular font-bold text-[var(--karya-primary)]">
                                {formatDH(Number(b.agency_payout_amount))}
                              </span>
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span
                              className={`font-semibold px-2 py-0.5 rounded-md ${
                                b.agency_ack_status === 'available'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : b.agency_ack_status === 'unavailable'
                                    ? 'bg-red-100 text-red-800 border border-red-200 font-bold'
                                    : 'bg-[var(--karya-bg)] text-[var(--karya-text-muted)] border border-[var(--karya-border)]'
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

                            {b.refund_allowed_by_admin && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                                الاسترجاع مفتوح للعميل
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${statusMeta.cls}`}>
                            {statusMeta.label}
                          </span>

                          {b.receipt_url && !b.receipt_url.startsWith('local://') && (
                            <button
                              type="button"
                              onClick={() => openReceiptPreview(b.booking_code, b.receipt_url)}
                              className="min-h-[38px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] hover:bg-[var(--karya-surface-muted)] text-[var(--karya-primary)] px-3 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                            >
                              <FileText className="w-3.5 h-3.5 text-[var(--karya-action)]" />
                              <span>عرض الوصل</span>
                            </button>
                          )}

                          {b.status === 'payment_uploaded' && (
                            <button
                              type="button"
                              onClick={() => handleVerifyPayment(b.id)}
                              className="min-h-[38px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-3.5 py-2 text-xs font-bold transition-colors"
                            >
                              تأكيد الاستلام
                            </button>
                          )}

                          {waUrl && (b.status === 'payment_verified' || b.status === 'payment_uploaded') && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="min-h-[38px] rounded-lg bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white px-3 py-2 text-xs font-bold transition-colors inline-flex items-center gap-1.5"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-[var(--karya-accent)]" />
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
                              className={`min-h-[38px] rounded-lg px-3 py-2 text-xs font-bold border transition-colors inline-flex items-center gap-1.5 ${
                                b.agency_ack_status === 'unavailable'
                                  ? 'bg-red-600 hover:bg-red-700 border-red-600 text-white'
                                  : 'bg-[var(--karya-surface)] hover:bg-[var(--karya-surface-muted)] border-[var(--karya-border)] text-[var(--karya-text)]'
                              }`}
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                              <span>تحويل لوكالة أخرى</span>
                            </button>
                          )}

                          {(b.status === 'payment_uploaded' || b.status === 'payment_verified') &&
                            !b.refund_allowed_by_admin && (
                              <button
                                type="button"
                                onClick={() => handleAllowRefund(b.id)}
                                className="min-h-[38px] rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 px-3 py-2 text-xs font-bold transition-colors"
                              >
                                فتح الاسترجاع للعميل
                              </button>
                            )}
                        </div>
                      </div>

                      {reassignBookingId === b.id && (
                        <form
                          onSubmit={(e) => handleReassignBooking(e, b.id)}
                          className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-action-soft)] p-3.5 space-y-2.5"
                        >
                          <div className="text-xs font-bold text-[var(--karya-primary)]">
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
                                className="flex-1 min-h-[40px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] px-3 py-2 text-xs font-semibold text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
                              >
                                {candidateCars.some(
                                  (c) =>
                                    b.car_city &&
                                    c.city.toLowerCase() === b.car_city.toLowerCase(),
                                ) && (
                                  <optgroup label={`في نفس المدينة (${getCityLabelAr(b.car_city || '')})`}>
                                    {candidateCars
                                      .filter(
                                        (c) =>
                                          b.car_city &&
                                          c.city.toLowerCase() === b.car_city.toLowerCase(),
                                      )
                                      .map((c) => (
                                        <option key={c.car_id} value={c.car_id}>
                                          {c.agency_name} — {c.brand} {c.model} ({c.daily_price} DH/يوم) · {c.agency_phone}
                                        </option>
                                      ))}
                                  </optgroup>
                                )}
                                {candidateCars.some(
                                  (c) =>
                                    !b.car_city ||
                                    c.city.toLowerCase() !== b.car_city.toLowerCase(),
                                ) && (
                                  <optgroup label="مدن أخرى">
                                    {candidateCars
                                      .filter(
                                        (c) =>
                                          !b.car_city ||
                                          c.city.toLowerCase() !== b.car_city.toLowerCase(),
                                      )
                                      .map((c) => (
                                        <option key={c.car_id} value={c.car_id}>
                                          {c.agency_name} ({getCityLabelAr(c.city)}) — {c.brand} {c.model} ({c.daily_price} DH/يوم) · {c.agency_phone}
                                        </option>
                                      ))}
                                  </optgroup>
                                )}
                              </select>
                              <button
                                type="submit"
                                disabled={reassigning}
                                className="min-h-[40px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 text-white px-4 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
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
                                className="min-h-[40px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] px-3 py-2 text-xs font-semibold text-[var(--karya-text-muted)]"
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
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-10 text-center text-sm text-[var(--karya-text-muted)]">
              لا توجد طلبات استرجاع مسجلة حالياً.
            </div>
          ) : (
            <div className="divide-y divide-[var(--karya-border)]">
              {payouts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--karya-surface-muted)] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--karya-primary)]">استرجاع مبلغ تأكيد الحجز للعميل</span>
                      <span className="text-[var(--karya-text-muted)]">·</span>
                      <span className="text-sm text-[var(--karya-text)]">{p.recipient_name}</span>
                    </div>
                    <div className="text-xs text-[var(--karya-text-muted)] flex flex-wrap items-center gap-2">
                      <span>{p.recipient_bank}</span>
                      <span dir="ltr" className="font-mono text-[var(--karya-text)]">
                        {p.recipient_rib}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(p.id, p.recipient_rib)}
                        className="inline-flex items-center gap-1 text-[var(--karya-action)] font-semibold hover:underline"
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
                    <span className="font-mono-tabular font-extrabold text-base text-[var(--karya-primary)]">
                      {formatDH(Number(p.amount))}
                    </span>
                    {p.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPayoutSent(p.id)}
                        className="min-h-[38px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-3.5 py-2 text-xs font-bold transition-colors"
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

          <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs overflow-hidden">
            {agencies.length === 0 ? (
              <div className="p-10 text-center text-sm text-[var(--karya-text-muted)]">
                لا توجد وكالات مسجلة للمراجعة حالياً.
              </div>
            ) : (
              <div className="divide-y divide-[var(--karya-border)]">
                {agencies.map((ag) => (
                  <div
                    key={ag.id}
                    className="p-4 space-y-3 hover:bg-[var(--karya-surface-muted)] transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-[var(--karya-primary)]">
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
                        <div className="text-xs text-[var(--karya-text-muted)] flex flex-wrap items-center gap-2">
                          <span>
                            الهاتف: <span dir="ltr" className="font-mono text-[var(--karya-text)]">{ag.phone}</span>
                          </span>
                          <span>·</span>
                          <span className={ag.terms_accepted_at ? 'text-emerald-700 font-semibold' : 'text-amber-700'}>
                            {ag.terms_accepted_at
                              ? 'موافق على: بدون ضمانة مالية + عمولة 10%'
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
                          className="min-h-[38px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] hover:bg-[var(--karya-bg)] text-[var(--karya-text)] px-3 py-1.5 text-xs font-semibold transition-colors inline-flex items-center gap-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-[var(--karya-action)]" />
                          <span>إعادة تعيين الرمز</span>
                        </button>
                        {ag.verification_status !== 'verified' ? (
                          <button
                            type="button"
                            onClick={() => handleVerifyAgency(ag.id, 'verified')}
                            className="min-h-[38px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-4 py-2 text-xs font-bold transition-colors"
                          >
                            توثيق الوكالة
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleVerifyAgency(ag.id, 'suspended')}
                            className="min-h-[38px] rounded-lg border border-[var(--karya-border)] hover:bg-[var(--karya-bg)] text-[var(--karya-text-muted)] px-3 py-1.5 text-xs font-semibold transition-colors"
                          >
                            إيقاف مؤقت
                          </button>
                        )}
                      </div>
                    </div>

                    {resetAgencyId === ag.id && (
                      <form
                        onSubmit={(e) => handleResetAgencyPin(e, ag)}
                        className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-action-soft)] p-3 space-y-2.5"
                      >
                        <div className="text-xs font-semibold text-[var(--karya-primary)]">
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
                            className="flex-1 min-h-[40px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] px-3 py-2 text-sm font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={resettingPin}
                            className="min-h-[40px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 text-white px-4 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5"
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
                            className="min-h-[40px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] px-3 py-2 text-xs font-semibold text-[var(--karya-text-muted)]"
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

      {receiptPreview && (
        <div
          className="fixed inset-0 z-50 bg-[#173B57]/70 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-[var(--karya-surface)] rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl border border-[var(--karya-border)]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--karya-border)]">
              <div className="font-extrabold text-sm text-[var(--karya-primary)]">
                وصل التحويل البنكي — {receiptPreview.bookingCode}
              </div>
              <button
                type="button"
                onClick={() => setReceiptPreview(null)}
                aria-label="إغلاق المعاينة"
                className="p-1.5 rounded-lg text-[var(--karya-text-muted)] hover:bg-[var(--karya-bg)] hover:text-[var(--karya-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-[var(--karya-bg)] flex flex-col items-center justify-center gap-3 max-h-[75vh] overflow-auto">
              {receiptPreview.isPdf ? (
                <a
                  href={receiptPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-5 py-2.5 text-sm font-bold inline-flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>فتح ملف الوصل (PDF)</span>
                </a>
              ) : (
                <img
                  src={receiptPreview.url}
                  alt={`وصل التحويل ${receiptPreview.bookingCode}`}
                  className="max-h-[65vh] w-auto rounded-xl object-contain border border-[var(--karya-border)] bg-[var(--karya-surface)]"
                />
              )}
              <a
                href={receiptPreview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[var(--karya-action)] hover:underline"
              >
                فتح في نافذة مستقلة
              </a>
            </div>
          </div>
        </div>
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
        className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold text-[var(--karya-primary)]">إضافة سيارة اقتصادية للكتالوج المركزي</h2>
            <p className="text-xs text-[var(--karya-text-muted)]">
              الكتالوج يضم من 30 إلى {MAX_CATALOG_CARS} صورة عالية الجودة تختار منها الوكالات سياراتها
            </p>
          </div>
          <span className="font-mono-tabular text-xs font-bold text-[var(--karya-action)]">
            {catalog.length} / {MAX_CATALOG_CARS}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">الشركة (Brand)</label>
            <input
              required
              list="known-economic-brands"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Dacia, Renault, Peugeot..."
              className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-sm text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
            />
            <datalist id="known-economic-brands">
              {KNOWN_ECONOMIC_BRANDS.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">الموديل (Model)</label>
            <input
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="Sandero Stepway, Clio 5..."
              className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-sm text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">الفئة</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-sm text-[var(--karya-text)] bg-[var(--karya-surface)] focus:border-[var(--karya-action)] focus:outline-none"
            >
              <option value="Économique">اقتصادية (Économique)</option>
              <option value="Citadine">مدينية صغيرة (Citadine)</option>
              <option value="SUV Économique">SUV اقتصادية</option>
              <option value="Berline Économique">سيدان اقتصادية</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">المقاعد</label>
            <input
              type="number"
              min={2}
              max={9}
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
              className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-sm font-mono-tabular text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">الوقود الافتراضي</label>
            <select
              value={defaultFuel}
              onChange={(e) => setDefaultFuel(e.target.value as FuelType)}
              className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-sm text-[var(--karya-text)] bg-[var(--karya-surface)] focus:border-[var(--karya-action)] focus:outline-none"
            >
              <option value="diesel">ديزل</option>
              <option value="essence">بنزين</option>
              <option value="hybrid">هجين</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">ناقل الحركة</label>
            <select
              value={defaultTransmission}
              onChange={(e) => setDefaultTransmission(e.target.value as TransmissionType)}
              className="w-full min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-sm text-[var(--karya-text)] bg-[var(--karya-surface)] focus:border-[var(--karya-action)] focus:outline-none"
            >
              <option value="manual">يدوي</option>
              <option value="automatic">أوتوماتيك</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-[var(--karya-text)] mb-1">
              صورة الموديل (رفع صورة أو رابط URL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="url"
                dir="ltr"
                placeholder="https://... (اختياري إذا تم رفع ملف)"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                className="flex-1 min-h-[42px] rounded-lg border border-[var(--karya-border)] px-3 py-2 text-xs font-mono text-[var(--karya-text)] focus:border-[var(--karya-action)] focus:outline-none"
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
                className="min-h-[42px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface-muted)] hover:bg-[var(--karya-bg)] px-3 py-2 text-xs font-bold text-[var(--karya-text)] flex items-center gap-1.5 shrink-0 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[var(--karya-text-muted)]" />
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
            className="min-h-[42px] rounded-xl bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 text-white px-5 py-2.5 text-xs font-bold flex items-center gap-1.5 transition-colors"
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
            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              brandFilter === 'all'
                ? 'bg-[var(--karya-primary)] text-white'
                : 'bg-[var(--karya-surface)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
            }`}
          >
            كل الشركات ({catalog.length})
          </button>
          {brands.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBrandFilter(b)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                brandFilter === b
                  ? 'bg-[var(--karya-primary)] text-white'
                  : 'bg-[var(--karya-surface)] border border-[var(--karya-border)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
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
              className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-xs overflow-hidden flex flex-col"
            >
              <div className="aspect-[16/10] bg-[var(--karya-surface-muted)]">
                <img
                  src={item.image_url}
                  alt={`${item.brand} ${item.model}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-3.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--karya-primary)] truncate">
                    {item.brand} {item.model}
                  </div>
                  <div className="text-[11px] text-[var(--karya-text-muted)] truncate">
                    {item.category} · {item.seats} مقاعد
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteModel(item)}
                  aria-label={`حذف ${item.brand} ${item.model}`}
                  className="p-1.5 rounded-lg text-[var(--karya-text-muted)] hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
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
