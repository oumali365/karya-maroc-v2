import React, { useMemo, useRef, useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  CalendarClock,
  Loader2,
  MapPin,
  CreditCard,
  AlertCircle,
} from 'lucide-react';
import {
  supabase,
  formatDH,
  getCityLabelAr,
  MOROCCAN_PICKUP_LOCATIONS,
} from '../lib/supabase';
import { BankTransferCheckout } from './BankTransferCheckout';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface BookingModalProps {
  car: CarOffer;
  onClose: () => void;
  onBookingCompleted: (booking: CreatedBooking) => void;
}

const TIME_SLOTS: string[] = Array.from({ length: 34 }, (_, idx) => {
  const totalMinutes = 7 * 60 + idx * 30; // 07:00 to 23:30
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mins = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
});

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

function getLicenseSeniorityInfo(issueDateStr: string): {
  valid: boolean;
  years: number;
  message: string;
  isRecent: boolean;
} | null {
  if (!issueDateStr) return null;
  const parsed = new Date(`${issueDateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    return {
      valid: false,
      years: 0,
      message: 'تاريخ إصدار الرخصة لا يمكن أن يكون في المستقبل.',
      isRecent: true,
    };
  }

  const diffYears = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const wholeYears = Math.floor(diffYears);

  if (diffYears < 1) {
    return {
      valid: true,
      years: 0,
      message: 'رخصة حديثة (أقل من سنة) — قد تطلب بعض الوكالات ضماناً إضافياً عند التسليم.',
      isRecent: true,
    };
  }

  return {
    valid: true,
    years: wholeYears,
    message:
      wholeYears === 1
        ? 'أقدمية الرخصة: سنة واحدة (مؤهل للكراء).'
        : `أقدمية الرخصة: ${wholeYears} سنوات (مؤهل للكراء).`,
    isRecent: false,
  };
}

export const BookingModal: React.FC<BookingModalProps> = ({
  car,
  onClose,
  onBookingCompleted,
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);

  const [step, setStep] = useState<'details' | 'payment' | 'done'>('details');
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

  const licenseInfo = useMemo(
    () => getLicenseSeniorityInfo(customerLicenseIssueDate),
    [customerLicenseIssueDate],
  );

  const totalAmount = Number((car.daily_price * days).toFixed(2));
  const commissionAmount = Number((totalAmount * 0.1).toFixed(2));
  const agencyPayoutAmount = Number((totalAmount - commissionAmount).toFixed(2));

  // Ensure mobile virtual keyboard never covers the currently focused input
  const handleFieldFocus = (
    e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const target = e.currentTarget;
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 180);
  };

  const handleCreateDraftBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    setErrorMsg(null);

    if (
      !customerName.trim() ||
      !customerCin.trim() ||
      !customerPhone.trim() ||
      !customerLicenseNumber.trim() ||
      !customerLicenseIssueDate
    ) {
      setErrorMsg('يرجى ملء جميع الحقول الإجبارية بما فيها رقم وتاريخ إصدار رخصة السياقة.');
      return;
    }

    if (licenseInfo && !licenseInfo.valid) {
      setErrorMsg(licenseInfo.message);
      return;
    }

    if (!resolvedPickupLocation) {
      setErrorMsg('يرجى اختيار مكان استلام السيارة أو إدخال العنوان المخصص.');
      return;
    }

    if (!pickupDate || !pickupTime) {
      setErrorMsg('يرجى تحديد تاريخ ووقت استلام السيارة.');
      return;
    }

    const deliveryAtLocal = `${pickupDate}T${pickupTime}`;
    const deliveryDateObj = new Date(deliveryAtLocal);
    if (Number.isNaN(deliveryDateObj.getTime())) {
      setErrorMsg('تاريخ أو وقت الاستلام غير صالح.');
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

        // Graceful fallback if deployed DB hasn't been re-migrated with new optional parameters yet
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

      // Demo / pre-migration mode
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
      setErrorMsg(err instanceof Error ? err.message : 'حدث خطأ أثناء إنشاء الطلب.');
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

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-5"
      dir="rtl"
    >
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]">
        {/* Mobile grab handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-[#FAFBF8] shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100 bg-[#FAFBF8] shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 truncate">
              {step === 'details' && 'معلومات الحجز واستلام السيارة'}
              {step === 'payment' && 'الدفع عبر التحويل البنكي'}
              {step === 'done' && 'تم إرسال طلبك بنجاح'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {car.brand} {car.model} · {getCityLabelAr(car.city)} · {car.agency_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <div className="grid grid-cols-3 border-b border-slate-100 text-xs font-semibold text-center bg-slate-50/60 shrink-0">
          <div
            className={`py-2.5 px-1 ${
              step === 'details'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                : 'text-slate-500'
            }`}
          >
            1. بيانات العميل
          </div>
          <div
            className={`py-2.5 px-1 ${
              step === 'payment'
                ? 'text-[#1B5E20] border-b-2 border-[#1B5E20] bg-white'
                : 'text-slate-500'
            }`}
          >
            2. التحويل البنكي
          </div>
          <div
            className={`py-2.5 px-1 ${
              step === 'done'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                : 'text-slate-500'
            }`}
          >
            3. تأكيد الضمان
          </div>
        </div>

        {/* Independently Scrollable Body (shrinks cleanly with mobile keyboard via dvh) */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-pb-24 px-4 sm:px-6 py-4 pb-8">
          {step === 'details' && (
            <form onSubmit={handleCreateDraftBooking} className="space-y-4">
              {/* Car Summary Strip */}
              <div className="flex items-center gap-3.5 rounded-xl bg-slate-50 p-3 border border-slate-200/70">
                <img
                  src={car.primary_image_url}
                  alt={`${car.brand} ${car.model}`}
                  referrerPolicy="no-referrer"
                  className="w-24 h-18 rounded-lg object-cover bg-slate-200 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-slate-900 truncate">
                    {car.brand} {car.model}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {car.fuel_type === 'diesel' ? 'ديزل' : 'بنزين'} ·{' '}
                    {car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}
                  </div>
                  <div className="text-sm font-bold text-emerald-700 mt-1 font-mono-tabular">
                    {formatDH(car.daily_price)} / يوم
                  </div>
                </div>
              </div>

              {/* Customer Identity & Driver License */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="booking-customer-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    الاسم الكامل <span className="text-amber-600">*</span>
                  </label>
                  <input
                    id="booking-customer-name"
                    required
                    type="text"
                    autoComplete="name"
                    placeholder="مثال: يوسف بنعلي"
                    value={customerName}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-customer-cin"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    رقم بطاقة التعريف (CIN) <span className="text-amber-600">*</span>
                  </label>
                  <input
                    id="booking-customer-cin"
                    required
                    type="text"
                    dir="ltr"
                    placeholder="BK123456"
                    value={customerCin}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setCustomerCin(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono uppercase focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-customer-phone"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    رقم الهاتف <span className="text-amber-600">*</span>
                  </label>
                  <input
                    id="booking-customer-phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    placeholder="06 12 34 56 78"
                    value={customerPhone}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-license-number"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    رقم رخصة السياقة (Permis de conduire) <span className="text-amber-600">*</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="booking-license-number"
                      required
                      type="text"
                      dir="ltr"
                      placeholder="12/345678"
                      value={customerLicenseNumber}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setCustomerLicenseNumber(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pr-3.5 pl-9 py-2.5 text-base sm:text-sm font-mono uppercase focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="booking-license-date"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    تاريخ إصدار رخصة السياقة <span className="text-amber-600">*</span>
                  </label>
                  <input
                    id="booking-license-date"
                    required
                    type="date"
                    max={todayStr}
                    value={customerLicenseIssueDate}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setCustomerLicenseIssueDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono-tabular focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                  />
                </div>

                {licenseInfo && (
                  <div
                    className={`sm:col-span-2 text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                      !licenseInfo.valid
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : licenseInfo.isRecent
                          ? 'bg-amber-50 border-amber-200 text-amber-800'
                          : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{licenseInfo.message}</span>
                  </div>
                )}

                {/* Smart Pickup Location Selector */}
                <div className="sm:col-span-2">
                  <label
                    htmlFor="booking-pickup-location"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    مكان استلام السيارة <span className="text-amber-600">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-emerald-700 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <select
                      id="booking-pickup-location"
                      required
                      value={selectedPickupOption}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setSelectedPickupOption(e.target.value)}
                      className="w-full min-h-[44px] appearance-none rounded-xl border border-slate-200 bg-white pr-9 pl-4 py-2.5 text-base sm:text-sm font-medium text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    >
                      <optgroup label="المطارات الرئيسية في المغرب">
                        {airportLocations.map((loc) => (
                          <option key={loc.id} value={loc.label}>
                            {loc.label}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="المدن ومراكز الاستلام">
                        {cityLocations.map((loc) => (
                          <option key={loc.id} value={loc.label}>
                            {loc.label}
                          </option>
                        ))}
                      </optgroup>
                      <option value="__custom__">نقطة استلام أخرى (فندق، محطة، عنوان مخصص...)</option>
                    </select>
                  </div>

                  {selectedPickupOption === '__custom__' && (
                    <input
                      required
                      type="text"
                      placeholder="اكتب عنوان الاستلام الدقيق (مثال: فندق المامونية، مراكش)"
                      value={customPickupLocation}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setCustomPickupLocation(e.target.value)}
                      className="mt-2.5 w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  )}
                </div>

                {/* Duration + Precise Pick-up Date & Time */}
                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="booking-days"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      عدد أيام الكراء <span className="text-amber-600">*</span>
                    </label>
                    <input
                      id="booking-days"
                      required
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={90}
                      value={days}
                      onFocus={handleFieldFocus}
                      onChange={(e) =>
                        setDays(Math.min(90, Math.max(1, parseInt(e.target.value || '1', 10))))
                      }
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono-tabular focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-pickup-date"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      تاريخ الاستلام <span className="text-amber-600">*</span>
                    </label>
                    <input
                      id="booking-pickup-date"
                      required
                      type="date"
                      min={todayStr}
                      value={pickupDate}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm font-mono-tabular focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="booking-pickup-time"
                      className="block text-xs font-semibold text-slate-700 mb-1.5"
                    >
                      وقت الاستلام <span className="text-amber-600">*</span>
                    </label>
                    <select
                      id="booking-pickup-time"
                      required
                      dir="ltr"
                      value={pickupTime}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base sm:text-sm font-mono-tabular text-center focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/15"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Financial Breakdown & Guarantee */}
              <div className="rounded-xl bg-emerald-50 border border-emerald-200/70 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>
                    إجمالي الكراء ({days} أيام × {car.daily_price} DH)
                  </span>
                  <span className="font-semibold text-slate-800 font-mono-tabular">
                    {formatDH(totalAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-emerald-950 font-bold">
                  <span>عربون تأكيد الحجز الآن (10%)</span>
                  <span className="text-lg text-[#1B5E20] font-mono-tabular">
                    {formatDH(commissionAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>يُدفع مباشرة للوكالة عند استلام السيارة (90%)</span>
                  <span className="font-semibold text-slate-800 font-mono-tabular">
                    {formatDH(agencyPayoutAmount)}
                  </span>
                </div>
                <div className="flex items-start gap-2 text-xs text-emerald-800 pt-2 border-t border-emerald-200/70">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    في حال عدم تسليم السيارة، استرجع عربونك كاملاً عبر التحويل الفوري لرقم هاتفك أو
                    حسابك البنكي (مثل Cash Plus أو التطبيقات البنكية) خلال ساعات من التحقق.
                  </span>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] rounded-xl bg-[#1B5E20] hover:bg-[#144718] disabled:opacity-65 disabled:cursor-not-allowed text-white py-3.5 px-5 font-bold text-sm transition-colors flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تجهيز طلب تحويل العربون...</span>
                  </>
                ) : (
                  <>
                    <CalendarClock className="w-4 h-4" />
                    <span>متابعة تحويل العربون ({formatDH(commissionAmount)})</span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'payment' && createdBooking && (
            <BankTransferCheckout
              booking={createdBooking}
              onPaymentSubmitted={handlePaymentSubmitted}
              onBack={() => setStep('details')}
            />
          )}

          {step === 'done' && createdBooking && (
            <div className="text-center space-y-4 py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h4 className="text-xl font-bold text-slate-900">تم استلام وصل العربون بنجاح</h4>
                <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
                  تقوم إدارة Karya الآن بالتحقق من تحويل العربون عبر بنك{' '}
                  <span className="font-bold text-slate-900">
                    {createdBooking.selected_bank_code}
                  </span>{' '}
                  وإشعار وكالة{' '}
                  <span className="font-bold text-slate-900">{createdBooking.agency_name}</span>{' '}
                  لتجهيز السيارة لك.
                </p>
              </div>

              <div className="rounded-2xl bg-[#FAFBF8] border border-emerald-900/10 p-4 space-y-2.5">
                <div className="text-xs text-slate-500">كود تتبع الحجز والضمان (احتفظ به)</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono-tabular text-lg font-bold text-slate-900">
                    {createdBooking.booking_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyBookingCode}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 text-white px-3 py-1.5 text-xs font-semibold hover:bg-emerald-800 min-h-[36px]"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'نُسخ' : 'نسخ'}</span>
                  </button>
                </div>
                {createdBooking.pickup_location && (
                  <div className="text-xs text-slate-600">
                    مكان الاستلام:{' '}
                    <span className="font-semibold text-slate-800">
                      {createdBooking.pickup_location}
                    </span>
                  </div>
                )}
                <div className="text-xs text-emerald-900 font-medium pt-2 border-t border-slate-200/70 space-y-1">
                  <div>
                    العربون المحوّل:{' '}
                    <span className="font-mono-tabular font-bold">
                      {formatDH(createdBooking.commission_amount)}
                    </span>
                  </div>
                  <div className="text-slate-600">
                    المتبقي للوكالة عند الاستلام:{' '}
                    <span className="font-mono-tabular font-bold text-slate-900">
                      {formatDH(createdBooking.agency_payout_amount)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[48px] rounded-xl bg-[#1B5E20] hover:bg-[#144718] text-white py-3 font-bold text-sm transition-colors"
              >
                العودة للرئيسية
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
