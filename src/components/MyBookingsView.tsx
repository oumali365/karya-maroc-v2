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
  Phone,
  Hash,
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
  badgeClasses: string;
  icon: React.ReactNode;
} {
  switch (status) {
    case 'payment_verified':
      return {
        label: 'مؤكد',
        badgeClasses: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
      };
    case 'car_delivered':
    case 'completed':
      return {
        label: 'تم الاستلام',
        badgeClasses: 'bg-[var(--karya-primary-soft)] text-[var(--karya-primary)] border border-[var(--karya-border)]',
        icon: <CarFront className="w-3.5 h-3.5 text-[var(--karya-primary)] shrink-0" />,
      };
    case 'refund_requested':
      return {
        label: 'قيد مراجعة الاسترجاع',
        badgeClasses: 'bg-red-50 text-red-700 border border-red-200',
        icon: <RotateCcw className="w-3.5 h-3.5 text-red-600 shrink-0" />,
      };
    case 'refunded':
      return {
        label: 'تم إرجاع مبلغ التأكيد',
        badgeClasses: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />,
      };
    case 'cancelled':
      return {
        label: 'ملغى',
        badgeClasses: 'bg-slate-100 text-[var(--karya-text-muted)] border border-[var(--karya-border)]',
        icon: <XCircle className="w-3.5 h-3.5 text-[var(--karya-text-muted)] shrink-0" />,
      };
    case 'pending_payment':
      return {
        label: 'بانتظار إرفاق الوصل',
        badgeClasses: 'bg-amber-50 text-amber-800 border border-amber-200',
        icon: <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
      };
    case 'payment_uploaded':
    default:
      return {
        label: 'قيد الانتظار',
        badgeClasses: 'bg-amber-50 text-amber-800 border border-amber-200',
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
      error: 'يرجى إدخال رقم الحساب أو رقم الهاتف لاسترجاع مبلغ تأكيد الحجز.',
    };
  }

  const moroccanMobileRegex = /^(?:0[67]\d{8}|(?:\+212|00212)[67]\d{8})$/;
  if (moroccanMobileRegex.test(compact)) {
    return { valid: true, value: trimmed };
  }

  if (/^(?:0[67]|\+?212|00212)/.test(compact) && compact.length < 16) {
    return {
      valid: false,
      value: trimmed,
      error:
        'رقم الهاتف المغربي غير مكتمل. يجب أن يبدأ بـ 06 أو 07 ويتكون من 10 أرقام، أو أدخل رقم حسابك البنكي.',
    };
  }

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

function getRefundEligibility(booking: CreatedBooking): {
  eligible: boolean;
  blockedMessage: string | null;
} {
  if (booking.status !== 'payment_uploaded' && booking.status !== 'payment_verified') {
    return { eligible: false, blockedMessage: null };
  }

  if (booking.dispute_flag) {
    return {
      eligible: false,
      blockedMessage:
        'تم تسجيل عدم التزام الزبون على الحجز من طرف الوكالة (عدم تطابق الرخصة أو عدم الحضور) — تواصل مع الإدارة.',
    };
  }

  if (booking.agency_ack_status === 'unavailable' || booking.refund_allowed_by_admin) {
    return { eligible: true, blockedMessage: null };
  }

  const deliveryTime = new Date(booking.delivery_at).getTime();
  if (
    booking.status === 'payment_verified' &&
    !Number.isNaN(deliveryTime) &&
    Date.now() > deliveryTime
  ) {
    return { eligible: true, blockedMessage: null };
  }

  if (booking.agency_ack_status === 'available') {
    return {
      eligible: false,
      blockedMessage:
        'الوكالة أكدت توفر السيارة والتزامها بالتسليم في الموعد — الاسترجاع متاح فقط إذا لم تتمكن الوكالة من تسليم السيارة.',
    };
  }

  return {
    eligible: false,
    blockedMessage:
      'يُفتح خيار الاسترجاع تلقائياً إذا أعلنت الوكالة عدم توفر السيارة أو لم تتمكن من تسليمها في الموعد.',
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

  const [refundTarget, setRefundTarget] = useState<CreatedBooking | null>(null);
  const [refundPhone, setRefundPhone] = useState('');
  const [refundRib, setRefundRib] = useState('');
  const [refundReason, setRefundReason] = useState('عدم توفر السيارة لدى الوكالة');
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
              agency_ack_status: row.agency_ack_status ?? 'pending',
              dispute_flag: row.dispute_flag ?? null,
              refund_allowed_by_admin: Boolean(row.refund_allowed_by_admin),
              is_demo: false,
            })),
          );
        }
      } catch {
        // Ignore if not signed in
      }
    };

    const refreshRecentDeviceBookings = async () => {
      const toRefresh = recentBookings.filter((b) => !b.is_demo && b.customer_phone);
      if (toRefresh.length === 0) return;

      const refreshed: CreatedBooking[] = [];
      for (const item of toRefresh) {
        try {
          const { data, error } = await supabase.rpc('get_customer_booking_by_phone', {
            p_booking_code: item.booking_code,
            p_customer_phone: item.customer_phone,
          });
          if (!error && Array.isArray(data) && data.length > 0) {
            const r = data[0];
            refreshed.push({
              ...item,
              booking_id: String(r.booking_id),
              car_image: item.car_image || String(r.car_image || ''),
              status: r.status,
              agency_ack_status: r.agency_ack_status ?? 'pending',
              dispute_flag: r.dispute_flag ?? null,
              refund_allowed_by_admin: Boolean(r.refund_allowed_by_admin),
            });
          }
        } catch {
          // Ignore single refresh failure
        }
      }

      if (active && refreshed.length > 0) {
        setLookupBookings((prev) => {
          const nextMap = new Map(prev.map((x) => [x.booking_code, x]));
          for (const r of refreshed) {
            nextMap.set(r.booking_code, r);
          }
          return Array.from(nextMap.values());
        });
      }
    };

    loadAuthenticatedCustomerBookings();
    refreshRecentDeviceBookings();
    return () => {
      active = false;
    };
  }, [recentBookings]);

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
          car_image: String(r.car_image || ''),
          agency_name: String(r.agency_name),
          city: String(r.city),
          days: Number(r.days),
          daily_price: 0,
          total_amount: Number(r.total_amount),
          commission_amount: Number(r.commission_amount),
          agency_payout_amount: Number(r.agency_payout_amount),
          delivery_at: String(r.delivery_at),
          status: r.status,
          customer_phone: trackPhone.trim(),
          agency_ack_status: r.agency_ack_status ?? 'pending',
          dispute_flag: r.dispute_flag ?? null,
          refund_allowed_by_admin: Boolean(r.refund_allowed_by_admin),
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

  const mergedMap = new Map<string, CreatedBooking>();
  for (const b of recentBookings) mergedMap.set(b.booking_code, b);
  for (const b of accountBookings) mergedMap.set(b.booking_code, b);
  for (const b of lookupBookings) mergedMap.set(b.booking_code, b);
  const displayedBookings = Array.from(mergedMap.values());

  const openRefundForBooking = (booking: CreatedBooking) => {
    setRefundTarget(booking);
    setRefundPhone(booking.customer_phone || trackPhone.trim() || '');
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

    if (!refundTarget) {
      setRefundError('يرجى تحديد الحجز المؤهل للاسترجاع أولاً.');
      return;
    }

    const activeCode = refundTarget.booking_code.trim().toUpperCase();

    const accountValidation = validateRefundDestination(refundRib);
    if (!accountValidation.valid) {
      setRefundError(accountValidation.error || 'يرجى إدخال رقم حساب أو رقم هاتف صحيح.');
      return;
    }

    setRefundSubmitting(true);
    try {
      const eligibility = getRefundEligibility(refundTarget);
      if (!eligibility.eligible) {
        throw new Error(
          eligibility.blockedMessage ||
            'لا يمكن طلب استرجاع مبلغ تأكيد الحجز ما دامت الوكالة ملتزمة بتوفير السيارة في الموعد.',
        );
      }

      if (!refundTarget.is_demo) {
        const { error } = await supabase.rpc('request_full_refund', {
          p_booking_id: refundTarget.booking_id,
          p_booking_code: refundTarget.booking_code,
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
        'تم تسجيل طلب الاسترجاع بنجاح. سيتم مراجعة طلبك وإرجاع المبلغ كاملاً وفق إجراءات الاسترجاع المعتمدة، إلى رقم هاتفك أو حسابك البنكي.',
      );
      setRefundRib('');
      setRefundPhone('');
      setRefundTarget(null);
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'تعذر تسجيل طلب الاسترجاع.');
    } finally {
      setRefundSubmitting(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6" dir="rtl">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[var(--karya-primary)]">حجوزاتي</h1>
          <p className="text-xs sm:text-sm text-[var(--karya-text-muted)]">
            تابع حالة طلبك برمز الحجز ورقم الهاتف، مع تفاصيل مبلغ تأكيد الحجز والمبلغ المتبقي عند الاستلام.
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowseCars}
          className="self-start sm:self-auto inline-flex items-center justify-center rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-extrabold transition-colors shadow-xs"
        >
          حجز سيارة جديدة
        </button>
      </div>

      {/* Track Booking Search Card */}
      <form
        onSubmit={handleLookupByPhone}
        className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] p-4 sm:p-5 space-y-3"
      >
        <div className="text-xs font-extrabold text-[var(--karya-primary)]">تتبع حجز برمز الطلب</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Hash className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              dir="ltr"
              placeholder="KRY-XXXXXX"
              value={trackCode}
              onChange={(e) => setTrackCode(e.target.value)}
              className="w-full min-h-[46px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] pr-9 pl-3.5 py-2 text-sm font-mono uppercase focus:bg-white focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>
          <div className="relative">
            <Phone className="w-4 h-4 text-[var(--karya-text-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="tel"
              dir="ltr"
              placeholder="06XXXXXXXX"
              value={trackPhone}
              onChange={(e) => setTrackPhone(e.target.value)}
              className="w-full min-h-[46px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] pr-9 pl-3.5 py-2 text-sm font-mono focus:bg-white focus:border-[var(--karya-action)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={lookupLoading}
            className="min-h-[46px] rounded-lg bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white px-5 py-2 text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2"
          >
            {lookupLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            <span>عرض الحجز</span>
          </button>
        </div>
        {lookupError && <div className="text-xs font-semibold text-red-600">{lookupError}</div>}
      </form>

      {refundFeedback && (
        <div
          role="status"
          className="rounded-xl bg-emerald-50 border border-emerald-200 px-5 py-3.5 text-xs sm:text-sm text-emerald-800 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
          <span>{refundFeedback}</span>
        </div>
      )}

      {/* BOOKING CARDS */}
      {displayedBookings.length === 0 ? (
        <div className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] p-10 text-center space-y-3">
          <CarFront className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h2 className="font-bold text-lg text-[var(--karya-primary)]">لا توجد حجوزات مسجلة حالياً</h2>
          <p className="text-xs sm:text-sm text-[var(--karya-text-muted)] max-w-md mx-auto">
            يمكنك تتبع أي حجز عبر إدخال رمز الطلب ورقم الهاتف أعلاه، أو تصفح السيارات المتاحة لإجراء حجز جديد.
          </p>
          <button
            type="button"
            onClick={onBrowseCars}
            className="inline-flex items-center justify-center mt-2 px-5 py-2.5 min-h-[44px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white text-xs sm:text-sm font-extrabold transition-colors"
          >
            تصفح السيارات المتاحة
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedBookings.map((booking) => {
            const badge = getStatusBadge(booking.status);
            const refundEligibility = getRefundEligibility(booking);
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
                className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] overflow-hidden flex flex-col sm:flex-row"
              >
                <div className="w-full sm:w-52 md:w-60 h-44 sm:h-auto bg-slate-100 shrink-0 relative overflow-hidden">
                  {booking.car_image ? (
                    <img
                      src={booking.car_image}
                      alt={booking.car_label}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <CarFront className="w-10 h-10" />
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between gap-4 min-w-0">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-lg sm:text-xl font-extrabold text-[var(--karya-primary)] truncate">
                          {booking.car_label}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--karya-text-muted)] mt-0.5">
                          <span className="font-mono-tabular font-bold text-[var(--karya-primary)]">
                            {booking.booking_code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{booking.agency_name}</span>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-extrabold whitespace-nowrap shrink-0 ${badge.badgeClasses}`}
                      >
                        {badge.icon}
                        <span>{badge.label}</span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--karya-text-muted)]">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[var(--karya-text-muted)]" />
                        <span>{getCityLabelAr(booking.city)}</span>
                      </span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span>{booking.days} أيام</span>
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="w-3.5 h-3.5 text-[var(--karya-text-muted)]" />
                        <span>{formattedDate}</span>
                      </span>
                    </div>

                    {booking.pickup_location && (
                      <div className="text-xs text-[var(--karya-text-muted)] truncate">
                        مكان التسليم: <strong className="text-[var(--karya-text)]">{booking.pickup_location}</strong>
                      </div>
                    )}
                  </div>

                  {/* Price Breakdown */}
                  <div className="rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)]/70 p-3.5 grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                        مبلغ تأكيد الحجز (10%)
                      </div>
                      <div className="text-base sm:text-lg font-extrabold text-[var(--karya-action)] font-mono-tabular mt-0.5">
                        {formatDH(booking.commission_amount)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[var(--karya-text-muted)]">
                        المبلغ المتبقي عند الاستلام (90%)
                      </div>
                      <div className="text-base sm:text-lg font-extrabold text-[var(--karya-primary)] font-mono-tabular mt-0.5">
                        {formatDH(booking.agency_payout_amount)}
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1 flex sm:justify-end">
                      <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--karya-action)]">
                        <ShieldCheck className="w-4 h-4" />
                        <span>بدون ضمانة مالية</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-[var(--karya-text-muted)]">
                      أي تمديد خارج المنصة لا يشمله مسار حماية مبلغ تأكيد الحجز.
                    </span>

                    {booking.agency_ack_status === 'unavailable' &&
                      (booking.status === 'payment_uploaded' ||
                        booking.status === 'payment_verified') && (
                        <div className="w-full rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
                          اعتذرت الوكالة عن توفير السيارة — يمكنك الآن طلب استرجاع مبلغ تأكيد الحجز كاملاً.
                        </div>
                      )}

                    {refundEligibility.eligible ? (
                      <button
                        type="button"
                        onClick={() => openRefundForBooking(booking)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 text-xs font-extrabold transition-colors whitespace-nowrap"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>طلب استرجاع مبلغ التأكيد</span>
                      </button>
                    ) : (
                      refundEligibility.blockedMessage && (
                        <div className="text-[11px] text-[var(--karya-text-muted)] leading-relaxed">
                          {refundEligibility.blockedMessage}
                        </div>
                      )
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Refund Request Panel */}
      {refundTarget && (
        <form
          id="refund-request-panel"
          onSubmit={handleSubmitRefund}
          className="bg-[var(--karya-surface)] rounded-xl border border-[var(--karya-border)] shadow-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <h2 className="text-base sm:text-lg font-extrabold text-[var(--karya-primary)] flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--karya-action)]" />
                <span>طلب استرجاع مبلغ تأكيد الحجز ({refundTarget.booking_code})</span>
              </h2>
              <p className="text-xs text-[var(--karya-text-muted)]">
                سيتم مراجعة طلبك وإرجاع المبلغ كاملاً وفق إجراءات الاسترجاع المعتمدة إلى رقم هاتفك أو حسابك البنكي — متاح عند عدم توفر السيارة أو عدم تمكن الوكالة من التسليم.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRefundTarget(null)}
              className="text-xs font-bold text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5">
                رقم الهاتف المرتبط بالحجز (للتحقق)
              </label>
              <input
                required
                type="tel"
                dir="ltr"
                placeholder="06XXXXXXXX"
                value={refundPhone}
                onChange={(e) => setRefundPhone(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2 text-sm font-mono bg-white focus:border-[var(--karya-action)] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="refund-destination-input"
                className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
              >
                رقم الهاتف (06/07) أو الحساب البنكي (RIB) للاسترجاع
              </label>
              <input
                id="refund-destination-input"
                required
                type="text"
                dir={refundRib ? 'ltr' : 'rtl'}
                placeholder="06XXXXXXXX أو رقم الحساب"
                value={refundRib}
                onChange={(e) => setRefundRib(e.target.value)}
                className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] px-3.5 py-2 text-sm font-mono focus:border-[var(--karya-action)] focus:outline-none placeholder:font-sans placeholder:text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5">السبب</label>
            <select
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-white px-3.5 py-2 text-sm focus:border-[var(--karya-action)] focus:outline-none"
            >
              <option value="عدم توفر السيارة لدى الوكالة">عدم توفر السيارة لدى الوكالة</option>
              <option value="تأخر تسليم السيارة عن الموعد المحدد">تأخر تسليم السيارة عن الموعد المحدد</option>
              <option value="إلغاء بتوجيه من إدارة المنصة">إلغاء بتوجيه من إدارة المنصة</option>
            </select>
          </div>

          {refundError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-xs sm:text-sm text-red-700">
              {refundError}
            </div>
          )}

          <button
            type="submit"
            disabled={refundSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-65 text-white px-5 py-2.5 min-h-[44px] text-sm font-extrabold transition-colors"
          >
            {refundSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>إرسال طلب الاسترجاع</span>
          </button>
        </form>
      )}
    </section>
  );
};
