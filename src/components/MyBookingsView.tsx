import React, { useState, useEffect } from 'react';
import {
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  XCircle,
  CarFront,
  MapPin,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Badge, InputField, PrimaryButton, SecondaryButton } from './ui';
import { useLanguage } from '../i18n';
import type { BadgeVariant } from './ui';
import type { BookingStatus, CreatedBooking } from '../types/karya';

interface MyBookingsViewProps {
  recentBookings: CreatedBooking[];
  onUpdateBookingStatus: (bookingCode: string, nextStatus: BookingStatus) => void;
  onBrowseCars: () => void;
}

function getTimelineStage(status: BookingStatus): {
  isCancelledOrRefund: boolean;
  activeStep: 1 | 2 | 3 | 4;
} {
  switch (status) {
    case 'payment_verified':
      return { isCancelledOrRefund: false, activeStep: 3 };
    case 'car_delivered':
    case 'completed':
      return { isCancelledOrRefund: false, activeStep: 4 };
    case 'refund_requested':
    case 'refunded':
    case 'cancelled':
      return { isCancelledOrRefund: true, activeStep: 1 };
    case 'pending_payment':
    case 'payment_uploaded':
    default:
      return { isCancelledOrRefund: false, activeStep: 1 };
  }
}

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  recentBookings,
  onUpdateBookingStatus,
  onBrowseCars,
}) => {
  const { lang, dir, t, formatPrice, getCityLabel } = useLanguage();

  const [accountBookings, setAccountBookings] = useState<CreatedBooking[]>([]);
  const [lookupBookings, setLookupBookings] = useState<CreatedBooking[]>([]);

  const [trackCode, setTrackCode] = useState('');
  const [trackPhone, setTrackPhone] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [refundTarget, setRefundTarget] = useState<CreatedBooking | null>(null);
  const [manualRefundMode, setManualRefundMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [refundRib, setRefundRib] = useState('');
  const [refundReason, setRefundReason] = useState(() => t('myBookings.refundReasonDefault'));
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

  const validateRefundDestination = (
    raw: string,
  ): { valid: boolean; value: string; error?: string } => {
    const trimmed = raw.trim();
    const compact = trimmed.replace(/[\s\-().]/g, '');

    if (!compact) {
      return {
        valid: false,
        value: trimmed,
        error: t('myBookings.refundMissingDest'),
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
        error: t('myBookings.refundIncompletePhone'),
      };
    }

    const flexibleAccountRegex = /^(?=(?:.*\d){6,})[A-Za-z0-9]{8,34}$/;
    if (flexibleAccountRegex.test(compact)) {
      return { valid: true, value: trimmed };
    }

    return {
      valid: false,
      value: trimmed,
      error: t('myBookings.refundInvalidDest'),
    };
  };

  const getStatusBadgeProps = (
    status: BookingStatus,
  ): { label: string; variant: BadgeVariant; icon: React.ReactNode } => {
    switch (status) {
      case 'payment_verified':
        return {
          label: t('myBookings.status.payment_verified'),
          variant: 'success',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        };
      case 'car_delivered':
      case 'completed':
        return {
          label: t(`myBookings.status.${status}`),
          variant: 'neutral',
          icon: <CarFront className="w-3.5 h-3.5" />,
        };
      case 'refund_requested':
        return {
          label: t('myBookings.status.refund_requested'),
          variant: 'error',
          icon: <RotateCcw className="w-3.5 h-3.5" />,
        };
      case 'refunded':
      case 'cancelled':
        return {
          label: t(`myBookings.status.${status}`),
          variant: 'error',
          icon: <XCircle className="w-3.5 h-3.5" />,
        };
      case 'pending_payment':
      case 'payment_uploaded':
      default:
        return {
          label: t(`myBookings.status.${status}`),
          variant: 'warning',
          icon: <Clock className="w-3.5 h-3.5" />,
        };
    }
  };

  const handleLookupByPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);

    if (!trackCode.trim() || !trackPhone.trim()) {
      setLookupError(t('myBookings.lookupMissingError'));
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
          is_demo: false,
        };
        setLookupBookings((prev) => [
          found,
          ...prev.filter((item) => item.booking_code !== found.booking_code),
        ]);
      } else {
        setLookupError(t('myBookings.lookupNotFound'));
      }
    } catch {
      setLookupError(t('myBookings.lookupFailed'));
    } finally {
      setLookupLoading(false);
    }
  };

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
      document
        .getElementById('refund-request-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
      setRefundError(t('myBookings.refundMissingCode'));
      return;
    }

    const accountValidation = validateRefundDestination(refundRib);
    if (!accountValidation.valid) {
      setRefundError(accountValidation.error || t('myBookings.refundInvalidDest'));
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

      setRefundFeedback(t('myBookings.refundSuccess'));
      setRefundRib('');
      setRefundTarget(null);
      setManualRefundMode(false);
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : t('myBookings.refundErrorFallback'));
    } finally {
      setRefundSubmitting(false);
    }
  };

  const timelineSteps = [
    t('myBookings.timeline.step1'),
    t('myBookings.timeline.step2'),
    t('myBookings.timeline.step3'),
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8" dir={dir}>
      {/* Page Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">{t('myBookings.title')}</h1>
          <p className="text-sm text-ink-muted max-w-2xl leading-relaxed">
            {t('myBookings.subtitle')}
          </p>
        </div>

        <SecondaryButton
          size="sm"
          onClick={() => {
            setRefundTarget(null);
            setManualRefundMode((v) => !v);
            setRefundError(null);
          }}
        >
          <RotateCcw className="w-3.5 h-3.5 text-navy" />
          <span>{t('myBookings.refundByCodeBtn')}</span>
        </SecondaryButton>
      </div>

      {/* Secure Lookup Card */}
      <form
        onSubmit={handleLookupByPhone}
        className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs space-y-3.5"
      >
        <div className="text-xs font-bold text-navy">{t('myBookings.lookupTitle')}</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <InputField
            type="text"
            dir="ltr"
            placeholder={t('myBookings.codePlaceholder')}
            className="font-mono uppercase"
            value={trackCode}
            onChange={(e) => setTrackCode(e.target.value)}
          />
          <InputField
            type="tel"
            dir="ltr"
            placeholder={t('myBookings.phonePlaceholder')}
            className="font-mono"
            value={trackPhone}
            onChange={(e) => setTrackPhone(e.target.value)}
          />
          <PrimaryButton type="submit" loading={lookupLoading} fullWidth>
            {!lookupLoading && <Search className="w-4 h-4" />}
            <span>{t('myBookings.lookupBtn')}</span>
          </PrimaryButton>
        </div>
        {lookupError && <div className="text-xs font-medium text-rose-700">{lookupError}</div>}
      </form>

      {refundFeedback && (
        <div
          role="status"
          className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-4 text-sm text-emerald-900 flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-700" />
          <span>{refundFeedback}</span>
        </div>
      )}

      {/* Bookings List */}
      {allBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] p-12 text-center space-y-4 shadow-xs">
          <CarFront className="w-10 h-10 text-ink-muted/50 mx-auto" />
          <div className="space-y-1">
            <h2 className="font-bold text-lg text-ink">{t('myBookings.emptyTitle')}</h2>
            <p className="text-sm text-ink-muted">{t('myBookings.emptySubtitle')}</p>
          </div>
          <PrimaryButton onClick={onBrowseCars}>{t('myBookings.browseBtn')}</PrimaryButton>
        </div>
      ) : (
        <div className="space-y-5">
          {allBookings.map((booking) => {
            const badge = getStatusBadgeProps(booking.status);
            const timeline = getTimelineStage(booking.status);
            const canRequestRefund =
              booking.status === 'payment_uploaded' || booking.status === 'payment_verified';

            const formattedDate = (() => {
              const dt = new Date(booking.delivery_at);
              return Number.isNaN(dt.getTime())
                ? booking.delivery_at
                : dt.toLocaleDateString(lang === 'ar' ? 'ar-MA' : 'fr-MA', {
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
                className="bg-white rounded-2xl border border-[#E5E0D5] p-5 sm:p-6 shadow-xs space-y-5"
              >
                {/* Top Card Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div className="flex items-start gap-4 min-w-0">
                    {booking.car_image ? (
                      <img
                        src={booking.car_image}
                        alt={booking.car_label}
                        referrerPolicy="no-referrer"
                        className="w-24 h-20 rounded-xl object-cover bg-ivory shrink-0 hidden sm:block border border-[#EFECE5]"
                      />
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-ivory text-navy/40 items-center justify-center shrink-0 hidden sm:flex border border-[#EFECE5]">
                        <CarFront className="w-7 h-7" />
                      </div>
                    )}

                    <div className="space-y-2 min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Badge variant={badge.variant} icon={badge.icon}>
                          {badge.label}
                        </Badge>
                        <span className="font-mono-tabular text-xs font-bold text-navy">
                          {booking.booking_code}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-ink font-latin truncate">
                        {booking.car_label}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-ink-muted">
                        <span className="font-medium text-ink/85">{booking.agency_name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{getCityLabel(booking.city)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          {booking.days} {t('common.daysUnit')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-latin tabular-nums">
                          <CalendarClock className="w-3.5 h-3.5 text-gold" />
                          <span>{formattedDate}</span>
                        </span>
                      </div>

                      {booking.pickup_location && (
                        <div className="text-xs text-ink-muted flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-gold shrink-0" />
                          <span>{booking.pickup_location}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Breakdown & Action */}
                  <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end justify-between gap-3 pt-4 md:pt-0 border-t md:border-t-0 border-[#EFECE5] shrink-0">
                    <div className="text-start md:text-end space-y-1">
                      <div className="text-xs text-ink-muted">
                        {t('myBookings.depositPaid')}{' '}
                        <span className="font-latin tabular-nums font-bold text-navy">
                          {formatPrice(booking.commission_amount)}
                        </span>
                      </div>
                      <div className="text-xs text-ink-muted">
                        {t('myBookings.remainingAtPickup')}{' '}
                        <span className="font-latin tabular-nums font-bold text-ink">
                          {formatPrice(booking.agency_payout_amount)}
                        </span>
                      </div>
                    </div>

                    {canRequestRefund && (
                      <button
                        type="button"
                        onClick={() => openRefundForBooking(booking)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/75 hover:bg-rose-100/80 text-rose-800 px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t('myBookings.requestRefundBtn')}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Status Timeline (Wait for receipt -> Confirmed -> Ready for pickup) */}
                {!timeline.isCancelledOrRefund && (
                  <div className="pt-4 border-t border-[#F0ECE3]">
                    <div className="grid grid-cols-3 gap-2">
                      {timelineSteps.map((stepLabel, idx) => {
                        const stepNum = idx + 1;
                        const isDone = timeline.activeStep > stepNum;
                        const isCurrent = timeline.activeStep === stepNum;
                        return (
                          <div key={stepLabel} className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold font-latin shrink-0 transition-colors ${
                                  isDone
                                    ? 'bg-emerald-700 text-white'
                                    : isCurrent
                                      ? 'bg-navy text-gold ring-2 ring-gold/35'
                                      : 'bg-ivory text-ink-muted border border-[#E5E0D5]'
                                }`}
                              >
                                {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : stepNum}
                              </span>
                              <span
                                className={`h-0.5 flex-1 rounded-full ${
                                  isDone
                                    ? 'bg-emerald-600'
                                    : isCurrent
                                      ? 'bg-gold/60'
                                      : 'bg-[#EAE6DD]'
                                }`}
                              />
                            </div>
                            <div
                              className={`text-[11px] sm:text-xs font-semibold truncate ${
                                isDone || isCurrent ? 'text-navy' : 'text-ink-muted'
                              }`}
                            >
                              {stepLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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
          className="bg-white rounded-2xl border border-[#E5E0D5] p-6 sm:p-8 shadow-xs space-y-5"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-navy flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-gold" />
                <span>{t('myBookings.refundPanelTitle')}</span>
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed">
                {t('myBookings.refundPanelSubtitle')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setRefundTarget(null);
                setManualRefundMode(false);
              }}
              className="text-xs font-semibold text-ink-muted hover:text-navy cursor-pointer"
            >
              {t('common.cancel')}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              required
              type="text"
              dir="ltr"
              readOnly={Boolean(refundTarget)}
              label={t('myBookings.linkedCode')}
              placeholder="KRY-XXXXXX"
              value={refundTarget ? refundTarget.booking_code : manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className={`font-mono uppercase ${refundTarget ? 'bg-ivory text-ink-muted' : ''}`}
            />

            <InputField
              id="refund-destination-input"
              required
              type="text"
              dir={refundRib ? 'ltr' : dir}
              label={t('myBookings.refundDestLabel')}
              placeholder={t('myBookings.refundDestPlaceholder')}
              hint={t('myBookings.refundDestHint')}
              value={refundRib}
              onChange={(e) => setRefundRib(e.target.value)}
              className="font-mono"
            />
          </div>

          <InputField
            type="text"
            label={t('myBookings.refundReasonLabel')}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
          />

          {refundError && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
              {refundError}
            </div>
          )}

          <PrimaryButton type="submit" loading={refundSubmitting} size="lg">
            <span>{t('myBookings.submitRefundBtn')}</span>
          </PrimaryButton>
        </form>
      )}
    </section>
  );
};
