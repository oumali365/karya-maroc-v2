import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  CalendarClock,
  MapPin,
  CreditCard,
  AlertCircle,
  User,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { supabase, MOROCCAN_PICKUP_LOCATIONS } from '../lib/supabase';
import { BankTransferCheckout } from './BankTransferCheckout';
import { Badge, InputField, PrimaryButton, SecondaryButton, SelectField } from './ui';
import { useLanguage } from '../i18n';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface BookingModalProps {
  car: CarOffer;
  onClose: () => void;
  onBookingCompleted: (booking: CreatedBooking) => void;
}

type ModalStep = 'driver' | 'pickup' | 'payment' | 'done';

const TIME_SLOTS: string[] = Array.from({ length: 34 }, (_, idx) => {
  const totalMinutes = 7 * 60 + idx * 30; // 07:00 to 23:30
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mins = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
});

const PICKUP_FR_LABELS: Record<string, string> = {
  'cmn-airport': 'Aéroport Mohammed V — Casablanca',
  'rak-airport': 'Aéroport Marrakech-Ménara — Marrakech',
  'aga-airport': 'Aéroport Agadir-Al Massira — Agadir',
  'tng-airport': 'Aéroport Tanger-Ibn Battouta — Tanger',
  'fez-airport': 'Aéroport Fès-Saïss — Fès',
  'rba-airport': 'Aéroport Rabat-Salé — Rabat',
  'oud-airport': 'Aéroport Oujda-Angads — Oujda',
  'casablanca-city': 'Centre-ville Casablanca / Gare Casa-Voyageurs',
  'marrakech-city': 'Centre-ville Marrakech (Guéliz / Gare)',
  'rabat-city': 'Centre-ville Rabat (Agdal / Gare)',
  'tangier-city': 'Centre-ville Tanger (Port / Gare Al Boraq)',
  'fes-city': 'Centre-ville Fès (Ville Nouvelle)',
  'agadir-city': 'Centre-ville Agadir (Corniche / Centre)',
  'meknes-city': 'Centre-ville Meknès',
  'kenitra-city': 'Centre-ville Kénitra (Gare)',
  'tetouan-city': 'Centre-ville Tétouan',
  'essaouira-city': 'Centre-ville Essaouira',
  'oujda-city': 'Centre-ville Oujda',
  'nador-city': 'Centre-ville Nador',
};

function getTodayDateString(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getDefaultPickupDateString(): string {
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function getDefaultPickupLocation(city: string): string {
  const match = MOROCCAN_PICKUP_LOCATIONS.find(
    (loc) => loc.cityFr.toLowerCase() === city.toLowerCase(),
  );
  return match ? match.label : MOROCCAN_PICKUP_LOCATIONS[0].label;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  car,
  onClose,
  onBookingCompleted,
}) => {
  const { lang, dir, t, formatPrice, getCityLabel } = useLanguage();
  const todayStr = useMemo(() => getTodayDateString(), []);

  const [step, setStep] = useState<ModalStep>('driver');
  const [customerName, setCustomerName] = useState('');
  const [customerCin, setCustomerCin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLicenseNumber, setCustomerLicenseNumber] = useState('');
  const [customerLicenseIssueDate, setCustomerLicenseIssueDate] = useState('');

  const [selectedPickupOption, setSelectedPickupOption] = useState<string>(() =>
    getDefaultPickupLocation(car.city),
  );
  const [customPickupLocation, setCustomPickupLocation] = useState('');

  const [days, setDays] = useState(2);
  const [pickupDate, setPickupDate] = useState(getDefaultPickupDateString);
  const [pickupTime, setPickupTime] = useState('10:00');

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const airportLocations = useMemo(
    () => MOROCCAN_PICKUP_LOCATIONS.filter((loc) => loc.category === 'airport'),
    [],
  );
  const cityLocations = useMemo(
    () => MOROCCAN_PICKUP_LOCATIONS.filter((loc) => loc.category === 'city'),
    [],
  );

  const resolvedPickupLocation =
    selectedPickupOption === '__custom__' ? customPickupLocation.trim() : selectedPickupOption;

  const displayLocationOption = (loc: (typeof MOROCCAN_PICKUP_LOCATIONS)[number]) =>
    lang === 'fr' ? PICKUP_FR_LABELS[loc.id] || loc.label : loc.label;

  const licenseInfo = useMemo(() => {
    if (!customerLicenseIssueDate) return null;
    const parsed = new Date(`${customerLicenseIssueDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed > today) {
      return {
        valid: false,
        years: 0,
        message: t('booking.licenseFutureError'),
        isRecent: true,
      };
    }

    const diffYears = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    const wholeYears = Math.floor(diffYears);

    if (diffYears < 1) {
      return {
        valid: true,
        years: 0,
        message: t('booking.licenseRecentWarn'),
        isRecent: true,
      };
    }

    return {
      valid: true,
      years: wholeYears,
      message:
        wholeYears === 1
          ? t('booking.licenseOneYear')
          : t('booking.licenseYears', { years: wholeYears }),
      isRecent: false,
    };
  }, [customerLicenseIssueDate, lang]);

  const totalAmount = Number((car.daily_price * days).toFixed(2));
  const commissionAmount = Number((totalAmount * 0.1).toFixed(2));
  const agencyPayoutAmount = Number((totalAmount - commissionAmount).toFixed(2));

  const handleFieldFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const target = e.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  };

  const handleAdvanceToPickup = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (
      !customerName.trim() ||
      !customerCin.trim() ||
      !customerPhone.trim() ||
      !customerLicenseNumber.trim() ||
      !customerLicenseIssueDate
    ) {
      setErrorMsg(t('booking.driverValidationError'));
      return;
    }

    if (licenseInfo && !licenseInfo.valid) {
      setErrorMsg(licenseInfo.message);
      return;
    }

    setStep('pickup');
  };

  const handleCreateDraftBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    setErrorMsg(null);

    if (!resolvedPickupLocation || !pickupDate || !pickupTime) {
      setErrorMsg(t('booking.pickupValidationError'));
      return;
    }

    const deliveryAtLocal = `${pickupDate}T${pickupTime}`;
    const deliveryDateObj = new Date(deliveryAtLocal);
    if (Number.isNaN(deliveryDateObj.getTime())) {
      setErrorMsg(t('booking.invalidDateError'));
      return;
    }

    submittingRef.current = true;
    setLoading(true);

    const packedNotes = [
      `مكان الاستلام: ${resolvedPickupLocation}`,
      `رخصة السياقة: ${customerLicenseNumber.trim().toUpperCase()}`,
      `تاريخ الإصدار: ${customerLicenseIssueDate}`,
    ].join(' | ');

    try {
      if (!car.is_demo) {
        let rpcResult = await supabase.rpc('create_booking', {
          p_agency_car_id: car.id,
          p_customer_name: customerName.trim(),
          p_customer_cin: customerCin.trim().toUpperCase(),
          p_customer_phone: customerPhone.trim(),
          p_days: days,
          p_delivery_at: deliveryDateObj.toISOString(),
          p_delivery_notes: packedNotes,
          p_customer_license_number: customerLicenseNumber.trim().toUpperCase(),
          p_customer_license_issue_date: customerLicenseIssueDate,
          p_pickup_location: resolvedPickupLocation,
        });

        if (
          rpcResult.error &&
          (rpcResult.error.message.includes('Could not find the function') ||
            rpcResult.error.message.includes('p_customer_license_number'))
        ) {
          rpcResult = await supabase.rpc('create_booking', {
            p_agency_car_id: car.id,
            p_customer_name: customerName.trim(),
            p_customer_cin: customerCin.trim().toUpperCase(),
            p_customer_phone: customerPhone.trim(),
            p_days: days,
            p_delivery_at: deliveryDateObj.toISOString(),
            p_delivery_notes: packedNotes,
          });
        }

        if (rpcResult.error) {
          throw new Error(rpcResult.error.message);
        }

        if (rpcResult.data && rpcResult.data[0]) {
          const row = rpcResult.data[0];
          const bookingObj: CreatedBooking = {
            booking_id: row.booking_id,
            booking_code: row.booking_code,
            car_label: `${car.brand} ${car.model}`,
            car_image: car.primary_image_url,
            agency_name: car.agency_name,
            city: car.city,
            pickup_location: resolvedPickupLocation,
            customer_license_number: customerLicenseNumber.trim().toUpperCase(),
            customer_license_issue_date: customerLicenseIssueDate,
            days,
            daily_price: car.daily_price,
            total_amount: Number(row.total_amount),
            commission_amount: Number(row.commission_amount),
            agency_payout_amount: Number(row.agency_payout_amount),
            delivery_at: deliveryAtLocal,
            status: 'pending_payment',
            is_demo: false,
          };
          setCreatedBooking(bookingObj);
          setStep('payment');
          return;
        }
      }

      const fallbackCode = `KRY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      const demoBooking: CreatedBooking = {
        booking_id: crypto.randomUUID(),
        booking_code: fallbackCode,
        car_label: `${car.brand} ${car.model}`,
        car_image: car.primary_image_url,
        agency_name: car.agency_name,
        city: car.city,
        pickup_location: resolvedPickupLocation,
        customer_license_number: customerLicenseNumber.trim().toUpperCase(),
        customer_license_issue_date: customerLicenseIssueDate,
        days,
        daily_price: car.daily_price,
        total_amount: totalAmount,
        commission_amount: commissionAmount,
        agency_payout_amount: agencyPayoutAmount,
        delivery_at: deliveryAtLocal,
        status: 'pending_payment',
        is_demo: true,
      };
      setCreatedBooking(demoBooking);
      setStep('payment');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('booking.createError'));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const handlePaymentSubmitted = (updated: CreatedBooking) => {
    setCreatedBooking(updated);
    onBookingCompleted(updated);
    setStep('done');
  };

  const copyBookingCode = async () => {
    if (!createdBooking) return;
    try {
      await navigator.clipboard.writeText(createdBooking.booking_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  const stepIndex = step === 'driver' ? 0 : step === 'pickup' ? 1 : step === 'payment' ? 2 : 3;
  const stepperItems = [
    t('booking.step1'),
    t('booking.step2'),
    t('booking.step3'),
    t('booking.step4'),
  ];

  const ForwardIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const BackIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <div
      className="fixed inset-0 z-50 bg-navy/65 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5"
      dir={dir}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-xl shadow-2xl border border-[#E5E0D5] overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]">
        {/* Mobile grab handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-ivory/70 shrink-0">
          <span className="w-10 h-1 rounded-full bg-[#D5CFC2]" aria-hidden="true" />
        </div>

        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#EFECE5] bg-ivory/60 shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-navy truncate">
              {step === 'driver' && t('booking.titleDriver')}
              {step === 'pickup' && t('booking.titlePickup')}
              {step === 'payment' && t('booking.titlePayment')}
              {step === 'done' && t('booking.titleDone')}
            </h3>
            <p className="text-xs text-ink-muted mt-0.5 truncate">
              <span className="font-latin font-semibold text-ink">
                {car.brand} {car.model}
              </span>{' '}
              · {getCityLabel(car.city)} · {car.agency_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-ink-muted hover:text-navy hover:bg-ivory-dark/70 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Clean 4-Step Progress Stepper */}
        <div className="grid grid-cols-4 border-b border-[#EFECE5] bg-ivory/40 shrink-0">
          {stepperItems.map((label, idx) => {
            const isActive = idx === stepIndex;
            const isCompleted = idx < stepIndex;
            return (
              <div
                key={label}
                className={`py-2.5 px-1.5 text-center text-[11px] sm:text-xs font-semibold transition-colors truncate ${
                  isActive
                    ? 'text-navy bg-white border-b-2 border-gold font-bold'
                    : isCompleted
                      ? 'text-emerald-800 bg-white/60 border-b-2 border-emerald-600/60'
                      : 'text-ink-muted'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-pb-24 px-4 sm:px-6 py-5 pb-8">
          {/* Compact Car Summary Strip on Steps 1 & 2 */}
          {(step === 'driver' || step === 'pickup') && (
            <div className="flex items-center gap-3.5 rounded-xl bg-ivory/70 p-3 border border-[#E5E0D5] mb-5">
              <img
                src={car.primary_image_url}
                alt={`${car.brand} ${car.model}`}
                referrerPolicy="no-referrer"
                className="w-24 h-16 rounded-lg object-cover bg-ivory-dark shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="font-bold text-ink font-latin truncate">
                  {car.brand} {car.model}
                </div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {t(`car.fuel.${car.fuel_type || 'diesel'}`)} ·{' '}
                  {t(`car.transmission.${car.transmission || 'manual'}`)}
                </div>
                <div className="text-sm font-extrabold text-navy mt-1 font-latin tabular-nums">
                  {formatPrice(car.daily_price, 0)} {t('common.perDay')}
                </div>
              </div>
            </div>
          )}

          {/* STEP 1: Driver Identity & License */}
          {step === 'driver' && (
            <form onSubmit={handleAdvanceToPickup} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <InputField
                  containerClassName="sm:col-span-2"
                  id="booking-customer-name"
                  required
                  type="text"
                  autoComplete="name"
                  label={`${t('booking.fullName')} *`}
                  placeholder={t('booking.fullNamePlaceholder')}
                  icon={<User className="w-4 h-4" />}
                  value={customerName}
                  onFocus={handleFieldFocus}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />

                <InputField
                  id="booking-customer-cin"
                  required
                  type="text"
                  dir="ltr"
                  label={`${t('booking.cin')} *`}
                  placeholder="BK123456"
                  className="font-mono uppercase"
                  value={customerCin}
                  onFocus={handleFieldFocus}
                  onChange={(e) => {
                    setCustomerCin(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />

                <InputField
                  id="booking-customer-phone"
                  required
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  label={`${t('booking.phone')} *`}
                  placeholder="06 12 34 56 78"
                  className="font-mono"
                  value={customerPhone}
                  onFocus={handleFieldFocus}
                  onChange={(e) => {
                    setCustomerPhone(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />

                <InputField
                  id="booking-license-number"
                  required
                  type="text"
                  dir="ltr"
                  label={`${t('booking.licenseNumber')} *`}
                  placeholder="12/345678"
                  icon={<CreditCard className="w-4 h-4" />}
                  className="font-mono uppercase"
                  value={customerLicenseNumber}
                  onFocus={handleFieldFocus}
                  onChange={(e) => {
                    setCustomerLicenseNumber(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />

                <InputField
                  id="booking-license-date"
                  required
                  type="date"
                  max={todayStr}
                  label={`${t('booking.licenseIssueDate')} *`}
                  className="font-mono-tabular"
                  value={customerLicenseIssueDate}
                  onFocus={handleFieldFocus}
                  onChange={(e) => {
                    setCustomerLicenseIssueDate(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                />
              </div>

              {licenseInfo && (
                <div
                  className={`text-xs px-3.5 py-2.5 rounded-xl border flex items-center gap-2 ${
                    !licenseInfo.valid
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : licenseInfo.isRecent
                        ? 'bg-gold-soft border-gold/40 text-[#8A6526]'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{licenseInfo.message}</span>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-800 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <PrimaryButton type="submit" fullWidth size="lg">
                <span>{t('booking.nextToPickup')}</span>
                <ForwardIcon className="w-4 h-4" />
              </PrimaryButton>
            </form>
          )}

          {/* STEP 2: Pickup Location, Date, Time & Financial Summary */}
          {step === 'pickup' && (
            <form onSubmit={handleCreateDraftBooking} className="space-y-4">
              <div className="space-y-2.5">
                <SelectField
                  id="booking-pickup-location"
                  required
                  label={`${t('booking.pickupLocation')} *`}
                  icon={<MapPin className="w-4 h-4 text-gold" />}
                  value={selectedPickupOption}
                  onFocus={handleFieldFocus}
                  onChange={(e) => setSelectedPickupOption(e.target.value)}
                >
                  <optgroup label={t('booking.airportsGroup')}>
                    {airportLocations.map((loc) => (
                      <option key={loc.id} value={loc.label}>
                        {displayLocationOption(loc)}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label={t('booking.citiesGroup')}>
                    {cityLocations.map((loc) => (
                      <option key={loc.id} value={loc.label}>
                        {displayLocationOption(loc)}
                      </option>
                    ))}
                  </optgroup>
                  <option value="__custom__">{t('booking.customLocationOption')}</option>
                </SelectField>

                {selectedPickupOption === '__custom__' && (
                  <InputField
                    required
                    type="text"
                    placeholder={t('booking.customLocationPlaceholder')}
                    value={customPickupLocation}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setCustomPickupLocation(e.target.value)}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <InputField
                  id="booking-days"
                  required
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={90}
                  label={`${t('booking.daysLabel')} *`}
                  className="font-mono-tabular"
                  value={days}
                  onFocus={handleFieldFocus}
                  onChange={(e) =>
                    setDays(Math.min(90, Math.max(1, parseInt(e.target.value || '1', 10))))
                  }
                />

                <InputField
                  id="booking-pickup-date"
                  required
                  type="date"
                  min={todayStr}
                  label={`${t('booking.pickupDate')} *`}
                  className="font-mono-tabular"
                  value={pickupDate}
                  onFocus={handleFieldFocus}
                  onChange={(e) => setPickupDate(e.target.value)}
                />

                <SelectField
                  id="booking-pickup-time"
                  required
                  dir="ltr"
                  label={`${t('booking.pickupTime')} *`}
                  className="font-mono-tabular text-center"
                  value={pickupTime}
                  onFocus={handleFieldFocus}
                  onChange={(e) => setPickupTime(e.target.value)}
                >
                  {TIME_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </SelectField>
              </div>

              {/* Financial Breakdown & 10% Deposit Guarantee */}
              <div className="rounded-2xl bg-ivory/80 border border-[#E5E0D5] p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>
                    {t('booking.totalRental')} ({days} × {formatPrice(car.daily_price, 0)})
                  </span>
                  <span className="font-semibold text-ink font-latin tabular-nums">
                    {formatPrice(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-navy font-bold">
                  <span>{t('booking.depositNow')}</span>
                  <span className="text-base sm:text-lg text-navy font-latin tabular-nums">
                    {formatPrice(commissionAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-ink-muted">
                  <span>{t('booking.payAtPickup')}</span>
                  <span className="font-semibold text-ink font-latin tabular-nums">
                    {formatPrice(agencyPayoutAmount)}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-ink pt-2.5 border-t border-[#E5E0D5]">
                  <ShieldCheck className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{t('booking.protectionText')}</span>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-sm text-rose-800 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <SecondaryButton
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setErrorMsg(null);
                    setStep('driver');
                  }}
                >
                  <BackIcon className="w-4 h-4" />
                  <span>{t('booking.backToDriver')}</span>
                </SecondaryButton>

                <PrimaryButton
                  type="submit"
                  fullWidth
                  size="lg"
                  loading={loading}
                >
                  {!loading && <CalendarClock className="w-4 h-4" />}
                  <span>
                    {loading
                      ? t('booking.submittingBooking')
                      : `${t('booking.submitBooking')} (${formatPrice(commissionAmount)})`}
                  </span>
                </PrimaryButton>
              </div>
            </form>
          )}

          {/* STEP 3: Bank Transfer Checkout */}
          {step === 'payment' && createdBooking && (
            <BankTransferCheckout
              booking={createdBooking}
              onPaymentSubmitted={handlePaymentSubmitted}
              onBack={() => setStep('pickup')}
            />
          )}

          {/* STEP 4: Confirmation */}
          {step === 'done' && createdBooking && (
            <div className="text-center space-y-5 py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xl font-bold text-navy">{t('booking.doneTitle')}</h4>
                <p className="text-sm text-ink-muted leading-relaxed">
                  {t('booking.doneSubtitlePrefix')}{' '}
                  <span className="font-bold text-ink font-latin">
                    {createdBooking.selected_bank_code}
                  </span>{' '}
                  {t('booking.doneSubtitleMid')}{' '}
                  <span className="font-bold text-ink">{createdBooking.agency_name}</span>{' '}
                  {t('booking.doneSubtitleSuffix')}
                </p>
              </div>

              <div className="rounded-2xl bg-ivory/75 border border-[#E5E0D5] p-4 sm:p-5 space-y-3">
                <div className="text-xs text-ink-muted">{t('booking.trackingCodeLabel')}</div>
                <div className="flex items-center justify-center gap-2.5">
                  <span className="font-mono-tabular text-lg font-extrabold text-navy">
                    {createdBooking.booking_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyBookingCode}
                    className="inline-flex items-center gap-1 rounded-lg bg-navy text-white px-3 py-1.5 text-xs font-semibold hover:bg-navy-light min-h-[36px] cursor-pointer"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-gold" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? t('booking.copied') : t('booking.copy')}</span>
                  </button>
                </div>

                {createdBooking.pickup_location && (
                  <div className="text-xs text-ink-muted">
                    {t('booking.pickupSummaryLabel')}{' '}
                    <span className="font-semibold text-ink">
                      {createdBooking.pickup_location}
                    </span>
                  </div>
                )}

                <div className="text-xs pt-3 border-t border-[#E5E0D5] space-y-1.5">
                  <div className="flex items-center justify-center gap-1.5 text-navy font-semibold">
                    <span>{t('booking.depositPaidLabel')}</span>
                    <span className="font-latin tabular-nums font-bold">
                      {formatPrice(createdBooking.commission_amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 text-ink-muted">
                    <span>{t('booking.remainingLabel')}</span>
                    <span className="font-latin tabular-nums font-bold text-ink">
                      {formatPrice(createdBooking.agency_payout_amount)}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex justify-center">
                  <Badge variant="warning" icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                    {t('checkout.protectionBadge')}
                  </Badge>
                </div>
              </div>

              <PrimaryButton fullWidth size="lg" onClick={onClose}>
                {t('booking.backHome')}
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
