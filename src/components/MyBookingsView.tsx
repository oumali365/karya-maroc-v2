import React, { useEffect, useState } from 'react';
import {
  Search,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  CarFront,
  MapPin,
  CalendarClock,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { supabase, formatDH, getCityLabelAr } from '../lib/supabase';
import type { BookingStatus, CreatedBooking } from '../types/karya';

interface MyBookingsViewProps {
  recentBookings: CreatedBooking[];
  onUpdateBookingStatus: (bookingCode: string, nextStatus: BookingStatus) => void;
  onBrowseCars: () => void;
}

function getStatusBadge(status: BookingStatus): {
  label: string;
  classes: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'payment_verified':
      return {
        label: 'مؤكد - جاهز للاستلام',
        classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
      };
    case 'car_delivered':
    case 'completed':
      return {
        label: 'تم استلام السيارة',
        classes: 'bg-slate-100 text-slate-800 border-slate-200',
        icon: <CarFront className="w-3.5 h-3.5 text-slate-600 shrink-0" />,
      };
    case 'refund_requested':
      return {
        label: 'قيد مراجعة الاسترجاع',
        classes: 'bg-red-50 text-red-800 border-red-200',
        icon: <RotateCcw className="w-3.5 h-3.5 text-red-600 shrink-0" />,
      };
    case 'refunded':
    case 'cancelled':
      return {
        label: 'ملغى / تم استرجاع التسبيق',
        classes: 'bg-red-50 text-red-800 border-red-200',
        icon: <XCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />,
      };
    case 'pending_payment':
    case 'payment_uploaded':
    default:
      return {
        label: 'بانتظار مراجعة الوصل',
        classes: 'bg-amber-50 text-amber-900 border-amber-200',
        icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
      };
  }
}

function validateRefundDestination(raw: string): {
  valid: boolean;
  value: string;
  error?: string;
} {
  const trimmed = raw.trim();
  const compact = trimmed.replace(/[\s\-().]/g, '');

  if (!compact) {
    return {
      valid: false,
      value: trimmed,
      error: 'يرجى إدخال رقم الحساب أو رقم الهاتف لاسترجاع التسبيق.',
    };
  }

  // Exact Moroccan mobile number (06/07 + 8 digits, or +212/00212 + 6/7 + 8 digits)
  const moroccanMobileRegex = /^(?:0[67]\d{8}|(?:\+212|00212)[67]\d{8})$/;
  if (moroccanMobileRegex.test(compact)) {
    return { valid: true, value: trimmed };
  }

  // If the user started typing a Moroccan mobile number (06, 07, +212, 00212) that isn't a longer RIB
  if (/^(?:0[67]|\+?212|00212)/.test(compact) && compact.length < 16) {
    return {
      valid: false,
      value: trimmed,
      error:
        'رقم الهاتف المغربي غير مكتمل. يجب أن يبدأ بـ 06 أو 07 ويتكون من 10 أرقام، أو أدخل رقم حسابك البنكي.',
    };
  }

  // Flexible bank account / wallet / RIB (8 to 34 alphanumeric chars, at least 6 digits)
  const flexibleAccountRegex = /^(?=(?:.*\d){6,})[A-Za-z0-9]{8,34}$/;
  if (flexibleAccountRegex.test(compact)) {
    return { valid: true, value: trimmed };
  }

  return {
    valid: false,
    value: trimmed,
    error:
      'يرجى إدخال رقم هاتف مغربي صحيح (يبدأ بـ 06 أو 07) أو رقم حساب بنكي صحيح (8 أرقام على الأقل).',
  };
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  recentBookings,
  onUpdateBookingStatus,
  onBrowseCars,
}) => {
  const [accountBookings, setAccountBookings] = useState<CreatedBooking[]>([]);
  const [lookupBookings, setLookupBookings] = useState<CreatedBooking[]>([]);

  const [trackCode, setTrackCode] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Active booking selected for refund request
  const [refundTarget, setRefundTarget] = useState<CreatedBooking | null>(null);
  const [manualRefundMode, setManualRefundMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [refundPhone, setRefundPhone] = useState('');
  const [refundRib, setRefundRib] = useState('');
  const [refundReason, setRefundReason] = useState('عدم توفر السيارة أو إلغاء الحجز وفق الشروط');
  const [refundSubmitting, setRefundSubmitting] = useState(false);
  const [refundFeedback, setRefundFeedback] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadAuthenticatedCustomerBookings = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) return;

        const { data, error } = await supabase
          .from('bookings')
          .select('*, agencies(name), agency_cars(brand, model, primary_image_url, city)')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && active) {
          setAccountBookings(
            data.map((row: Record<string, any>) => ({
              booking_id: String(row.id),
              booking_code: String(row.booking_code),
              car_label: `${row.agency_cars?.brand || ''} ${row.agency_cars?.model || ''}`.trim(),
              car_image: String(row.agency_cars?.primary_image_url || ''),
              agency_name: String(row.agencies?.name || ''),
              city: String(row.agency_cars?.city || ''),
              pickup_location: row.pickup_location ?? undefined,
              days: Number(row.days),
              daily_price: Number(row.daily_price),
              total_amount: Number(row.total_amount),
              commission_amount: Number(row.commission_amount),
              agency_payout_amount: Number(row.agency_payout_amount),
              delivery_at: String(row.delivery_at),
              status: row.status,
              handover_pin: row.handover_pin ? String(row.handover_pin) : undefined,
              is_demo: false,
            })),
          );
        }
      } catch {
        // Ignore if not signed in
      }
    };

    loadAuthenticatedCustomerBookings();
    return () => {
      active = false;
    };
  }, []);

  const handleLookupByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);

    if (!trackCode.trim() || !trackPhone.trim()) {
      setLookupError('أدخل رمز الحجز ورقم الهاتف المرتبط بالحجز.');
      return;
    }

    setLookupLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_customer_booking_by_phone', {
        p_booking_code: trackCode.trim().toUpperCase(),
        p_customer_phone: trackPhone.trim(),
      });

      if (!error && Array.isArray(data) && data.length > 0) {
        const r = data[0];
        const found: CreatedBooking = {
          booking_id: String(r.booking_id),
          booking_code: String(r.booking_code),
          car_label: String(r.car_label),
          car_image: '',
          agency_name: String(r.agency_name),
          city: String(r.city),
          days: Number(r.days),
          daily_price: 0,
          total_amount: Number(r.total_amount),
          commission_amount: Number(r.commission_amount),
          agency_payout_amount: Number(r.agency_payout_amount),
          delivery_at: String(r.delivery_at),
          status: r.status,
          handover_pin: r.handover_pin ? String(r.handover_pin) : undefined,
          is_demo: false,
        };
        setLookupBookings((prev) => [
          found,
          ...prev.filter((item) => item.booking_code !== found.booking_code),
        ]);
      } else {
        setLookupError('لم يتم العثور على حجز مطابق لرمز الحجز ورقم الهاتف.');
      }
    } catch {
      setLookupError('تعذر البحث عن الحجز حالياً.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Merge deduplicated bookings: DB lookup/account bookings override local session status if newer
  const mergedMap = new Map<string, CreatedBooking>();
  for (const b of recentBookings) mergedMap.set(b.booking_code, b);
  for (const b of accountBookings) mergedMap.set(b.booking_code, b);
  for (const b of lookupBookings) mergedMap.set(b.booking_code, b);
  const allBookings = Array.from(mergedMap.values());

  const openRefundForBooking = (booking: CreatedBooking) => {
    setManualRefundMode(false);
    setRefundTarget(booking);
    setRefundError(null);
    setRefundFeedback(null);
    window.setTimeout(() => {
      document.getElementById('refund-request-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefundError(null);
    setRefundFeedback(null);

    const activeCode = (refundTarget?.booking_code || manualCode).trim().toUpperCase();
    const matchedBooking =
      refundTarget || allBookings.find((b) => b.booking_code.toUpperCase() === activeCode) || null;

    if (!activeCode) {
      setRefundError('يرجى تحديد الحجز أو إدخال رمز الحجز (KRY-XXXXXX).');
      return;
    }

    const accountValidation = validateRefundDestination(refundRib);
    if (!accountValidation.valid) {
      setRefundError(accountValidation.error || 'يرجى إدخال رقم حساب أو رقم هاتف صحيح.');
      return;
    }

    setRefundSubmitting(true);
    try {
      if (matchedBooking && !matchedBooking.is_demo) {
        const { error } = await supabase.rpc('request_full_refund', {
          p_booking_id: matchedBooking.booking_id,
          p_booking_code: matchedBooking.booking_code,
          p_customer_rib: accountValidation.value,
          p_reason: refundReason,
          p_customer_phone: refundPhone.trim() || trackPhone.trim() || null,
        });
        if (error) throw new Error(error.message);
      }

      onUpdateBookingStatus(activeCode, 'refund_requested');
      setLookupBookings((prev) =>
        prev.map((item) =>
          item.booking_code === activeCode ? { ...item, status: 'refund_requested' } : item,
        ),
      );
      setAccountBookings((prev) =>
        prev.map((item) =>
          item.booking_code === activeCode ? { ...item, status: 'refund_requested' } : item,
        ),
      );

      setRefundFeedback(
        'تم تسجيل طلب الاسترجاع بنجاح. استرجع تسبيقك كاملاً عبر التحويل الفوري لرقم هاتفك أو حسابك البنكي (مثل Cash Plus أو التطبيقات البنكية) خلال ساعات من التحقق.',
      );
      setRefundRib('');
      setRefundPhone('');
      setRefundTarget(null);
      setManualRefundMode(false);
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'تعذر تسجيل طلب الاسترجاع.');
    } finally {
      setRefundSubmitting(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6" dir="rtl">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-slate-900">حجوزاتي</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            تابع حالة طلباتك أو اطلب استرجاع التسبيق فورياً عند تعذر التسليم.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefundTarget(null);
            setManualRefundMode((v) => !v);
            setRefundError(null);
          }}
          className="self-start sm:self-auto inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#2563EB]" />
          <span>استرجاع برمز الحجز</span>
        </button>
      </div>

      {/* Secure Lookup Form */}
      <form
        onSubmit={handleLookupByPhone}
        className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 space-y-3"
      >
        <div className="text-xs font-bold text-slate-700">تتبع حجز سابق</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            dir="ltr"
            placeholder="رمز الحجز (KRY-XXXXXX)"
            value={trackCode}
            onChange={(e) => setTrackCode(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-sm font-mono uppercase focus:bg-white focus:border-[#2563EB] focus:outline-none"
          />
          <input
            type="tel"
            dir="ltr"
            placeholder="رقم الهاتف"
            value={trackPhone}
            onChange={(e) => setTrackPhone(e.target.value)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2 text-sm font-mono focus:bg-white focus:border-[#2563EB] focus:outline-none"
          />
          <button
            type="submit"
            disabled={lookupLoading}
            className="min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2 text-xs font-bold transition-colors flex items-center justify-center gap-2"
          >
            {lookupLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>عرض الحجز</span>
          </button>
        </div>
        {lookupError && <div className="text-xs text-red-600">{lookupError}</div>}
      </form>

      {refundFeedback && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-3.5 text-xs sm:text-sm text-emerald-900 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
          <span>{refundFeedback}</span>
        </div>
      )}

      {/* Bookings List */}
      {allBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center space-y-4">
          <CarFront className="w-10 h-10 text-slate-300 mx-auto" />
          <div className="space-y-1">
            <h2 className="font-bold text-base sm:text-lg text-slate-900">لا توجد حجوزات حالياً</h2>
            <p className="text-xs sm:text-sm text-slate-500">
              ابحث برمز الحجز أعلاه أو تصفح السيارات المتاحة.
            </p>
          </div>
          <button
            type="button"
            onClick={onBrowseCars}
            className="inline-flex items-center justify-center rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-5 py-2.5 text-xs sm:text-sm font-bold transition-colors"
          >
            تصفح السيارات
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {allBookings.map((booking) => {
            const badge = getStatusBadge(booking.status);
            const canRequestRefund =
              booking.status === 'payment_uploaded' || booking.status === 'payment_verified';
            const formattedDate = (() => {
              const dt = new Date(booking.delivery_at);
              return Number.isNaN(dt.getTime())
                ? booking.delivery_at
                : dt.toLocaleDateString('ar-MA', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
            })();

            return (
              <article
                key={booking.booking_code}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-4 min-w-0">
                  {booking.car_image ? (
                    <img
                      src={booking.car_image}
                      alt={booking.car_label}
                      referrerPolicy="no-referrer"
                      className="w-24 h-20 rounded-xl object-cover bg-slate-100 shrink-0 hidden sm:block"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-slate-100 text-slate-400 items-center justify-center shrink-0 hidden sm:flex">
                      <CarFront className="w-7 h-7" />
                    </div>
                  )}

                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-bold ${
                          booking.status === 'payment_verified'
                            ? 'text-emerald-700'
                            : booking.status === 'refund_requested' ||
                                booking.status === 'refunded' ||
                                booking.status === 'cancelled'
                              ? 'text-red-700'
                              : 'text-amber-700'
                        }`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono-tabular font-semibold text-slate-500">
                        {booking.booking_code}
                      </span>
                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                      {booking.car_label}
                    </h3>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                      <span>{booking.agency_name}</span>
                      <span aria-hidden="true">·</span>
                      <span>{getCityLabelAr(booking.city)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{booking.days} أيام</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    {booking.pickup_location && (
                      <div className="text-xs text-slate-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{booking.pickup_location}</span>
                      </div>
                    )}

                    {booking.handover_pin &&
                      (booking.status === 'payment_uploaded' ||
                        booking.status === 'payment_verified') && (
                        <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 border border-blue-200/80 px-3 py-1.5 text-xs">
                          <KeyRound className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                          <span className="text-slate-700 font-semibold">رمز التسليم السري:</span>
                          <span
                            dir="ltr"
                            className="font-mono-tabular font-extrabold text-[#2563EB] tracking-wider"
                          >
                            {booking.handover_pin}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            (لا يُعطى للوكالة إلا عند استلام المفاتيح بدون ضمان)
                          </span>
                        </div>
                      )}

                    <div className="text-[11px] text-slate-400 pt-0.5">
                      ملاحظة: أي تمديد أو اتفاق خارج المنصة لا تشمله حماية المنصة أو ضمان الاسترجاع.
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                  <div className="text-right md:text-left space-y-0.5 text-xs text-slate-500">
                    <div>
                      التسبيق:{' '}
                      <span className="font-mono-tabular font-bold text-[#2563EB]">
                        {formatDH(booking.commission_amount)}
                      </span>
                    </div>
                    <div>
                      عند الاستلام:{' '}
                      <span className="font-mono-tabular font-bold text-slate-900">
                        {formatDH(booking.agency_payout_amount)}
                      </span>
                    </div>
                  </div>

                  {canRequestRefund && (
                    <button
                      type="button"
                      onClick={() => openRefundForBooking(booking)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/70 hover:bg-red-100/80 text-red-700 px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>طلب استرجاع</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Refund Request Panel */}
      {(refundTarget || manualRefundMode) && (
        <form
          id="refund-request-panel"
          onSubmit={handleSubmitRefund}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#2563EB]" />
                <span>طلب استرجاع التسبيق</span>
              </h2>
              <p className="text-xs text-slate-500">
                تحويل فوري عبر رقم الهاتف (Cash Plus) أو الحساب البنكي.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRefundTarget(null);
                setManualRefundMode(false);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-900"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رمز الحجز
              </label>
              <input
                required
                type="text"
                dir="ltr"
                readOnly={Boolean(refundTarget)}
                placeholder="KRY-XXXXXX"
                value={refundTarget ? refundTarget.booking_code : manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className={`w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono uppercase focus:border-[#2563EB] focus:outline-none ${
                  refundTarget ? 'bg-slate-50 text-slate-700' : 'bg-white'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رقم الهاتف المرتبط بالحجز (للتحقق الأمني)
              </label>
              <input
                required
                type="tel"
                dir="ltr"
                placeholder="06XXXXXXXX"
                value={refundPhone}
                onChange={(e) => setRefundPhone(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono bg-white focus:border-[#2563EB] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="refund-destination-input"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                رقم الهاتف (06/07) أو الحساب البنكي (RIB) لاسترجاع التسبيق
              </label>
              <input
                id="refund-destination-input"
                required
                type="text"
                dir={refundRib ? 'ltr' : 'rtl'}
                placeholder="06XXXXXXXX أو رقم الحساب"
                value={refundRib}
                onChange={(e) => setRefundRib(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-mono focus:border-[#2563EB] focus:outline-none placeholder:font-sans placeholder:text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">السبب</label>
            <input
              type="text"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full min-h-[44px] rounded-xl border border-slate-200 px-3.5 py-2 text-sm focus:border-[#2563EB] focus:outline-none"
            />
          </div>

          {refundError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs sm:text-sm text-red-700">
              {refundError}
            </div>
          )}

          <button
            type="submit"
            disabled={refundSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-65 text-white px-5 py-2.5 text-sm font-bold transition-colors"
          >
            {refundSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>إرسال طلب الاسترجاع</span>
          </button>
        </form>
      )}
    </section>
  );
};
