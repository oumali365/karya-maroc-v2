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
  Star,
  Fuel,
  Gauge,
  Users,
  ArrowLeft,
  ArrowRight,
  Minus,
  Plus,
  Navigation,
} from 'lucide-react';
import {
  supabase,
  formatDH,
  getCityLabelAr,
  findNearestMoroccanCity,
} from '../lib/supabase';
import { BankTransferCheckout } from './BankTransferCheckout';
import type { CarOffer, CreatedBooking } from '../types/karya';

interface BookingModalProps {
  car: CarOffer;
  initialPickupDate?: string;
  initialDays?: number;
  onClose: () => void;
  onBookingCompleted: (booking: CreatedBooking) => void;
}

const TIME_SLOTS: string[] = Array.from({ length: 34 }, (_, idx) => {
  const totalMinutes = 7 * 60 + idx * 30;
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

function getLicenseSeniorityInfo(issueDateStr: string): {
  valid: boolean;
  message: string;
} | null {
  if (!issueDateStr) return null;
  const parsed = new Date(`${issueDateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (parsed > today) {
    return {
      valid: false,
      message: 'تاريخ إصدار الرخصة غير صالح.',
    };
  }

  // Exact 2-year cutoff check (today minus 2 years)
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  twoYearsAgo.setHours(23, 59, 59, 999);

  if (parsed > twoYearsAgo) {
    return {
      valid: false,
      message:
        'تشترط المنصة أقدمية رخصة سياقة لا تقل عن سنتين (24 شهراً) للاستفادة من الكراء بدون ضمان.',
    };
  }

  const diffYears = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const wholeYears = Math.max(2, Math.floor(diffYears));

  return {
    valid: true,
    message: `أقدمية الرخصة: ${wholeYears} سنوات (مؤهل للكراء بدون ضمان).`,
  };
}

function getFuelLabelAr(fuel: CarOffer['fuel_type']): string {
  if (fuel === 'diesel') return 'ديزل';
  if (fuel === 'hybrid') return 'هجين';
  if (fuel === 'electric') return 'كهرباء';
  return 'بنزين';
}

export const BookingModal: React.FC<BookingModalProps> = ({
  car,
  initialPickupDate,
  initialDays,
  onClose,
  onBookingCompleted,
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);

  const [step, setStep] = useState<'overview' | 'details' | 'payment' | 'done'>('overview');
  const [customerName, setCustomerName] = useState('');
  const [customerCin, setCustomerCin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLicenseNumber, setCustomerLicenseNumber] = useState('');
  const [customerLicenseIssueDate, setCustomerLicenseIssueDate] = useState('');

  const [pickupLocation, setPickupLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const [days, setDays] = useState(() =>
    initialDays && initialDays >= 3 && initialDays <= 90 ? initialDays : 3,
  );
  const [pickupDate, setPickupDate] = useState(() =>
    initialPickupDate && initialPickupDate >= todayStr
      ? initialPickupDate
      : getDefaultPickupDateString(),
  );
  const [pickupTime, setPickupTime] = useState('10:00');

  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [driverPledgeAccepted, setDriverPledgeAccepted] = useState(false);

  const resolvedPickupLocation = pickupLocation.trim();

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote('المتصفح لا يدعم تحديد الموقع، اكتب عنوانك الحالي أدناه.');
      return;
    }

    setDetectingLocation(true);
    setLocationNote(null);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const nearest = findNearestMoroccanCity(lat, lng);
        const formattedLocation = `الموقع الحالي (${nearest.city.nameAr}) — ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        setLocationCoords({ lat, lng });
        setPickupLocation(formattedLocation);
        setLocationNote(`تم تحديد موقعك قرب ${nearest.city.nameAr} لتسهيل تسليم السيارة.`);
        setDetectingLocation(false);
      },
      () => {
        setLocationNote('تعذر الوصول للموقع تلقائياً، يرجى كتابة عنوانك الحالي أدناه.');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const licenseInfo = useMemo(
    () => getLicenseSeniorityInfo(customerLicenseIssueDate),
    [customerLicenseIssueDate],
  );

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

  const handleCreateDraftBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || loading) return;

    setErrorMsg(null);

    if (days < 3) {
      setErrorMsg('الحد الأدنى للكراء في المنصة هو 3 أيام.');
      return;
    }

    if (
      !customerName.trim() ||
      !customerCin.trim() ||
      !customerPhone.trim() ||
      !customerLicenseNumber.trim() ||
      !customerLicenseIssueDate
    ) {
      setErrorMsg('يرجى ملء جميع الحقول الإجبارية.');
      return;
    }

    if (!licenseInfo || !licenseInfo.valid) {
      setErrorMsg(
        licenseInfo?.message ||
          'تشترط المنصة أقدمية رخصة سياقة لا تقل عن سنتين (24 شهراً) للاستفادة من الكراء بدون ضمان.',
      );
      return;
    }

    if (!driverPledgeAccepted) {
      setErrorMsg(
        'يرجى تأكيد الإقرار بصحة تاريخ رخصة السياقة (سنتان+) والبطاقة الوطنية قبل المتابعة.',
      );
      return;
    }

    if (!resolvedPickupLocation) {
      setErrorMsg('يرجى تحديد موقعك الحالي أو كتابة عنوان الاستلام.');
      return;
    }

    if (!pickupDate || !pickupTime) {
      setErrorMsg('يرجى تحديد تاريخ ووقت الاستلام.');
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
        if (
          createdBooking &&
          !createdBooking.is_demo &&
          createdBooking.status === 'pending_payment'
        ) {
          try {
            await supabase.rpc('cancel_pending_booking', {
              p_booking_id: createdBooking.booking_id,
              p_booking_code: createdBooking.booking_code,
            });
          } catch {
            // Proceed even if old DB schema doesn't have cancel_pending_booking yet
          }
        }

        let defaultBankId: string | null = null;
        try {
          const { data: bankRows } = await supabase
            .from('platform_banks')
            .select('id')
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .limit(1);
          if (bankRows && bankRows[0]?.id) {
            defaultBankId = String(bankRows[0].id);
          }
        } catch {
          // Proceed with null if platform_banks lookup fails
        }

        let rpcResult = await supabase.rpc('create_booking', {
          p_agency_car_id: car.id,
          p_customer_name: customerName.trim(),
          p_customer_cin: customerCin.trim().toUpperCase(),
          p_customer_phone: customerPhone.trim(),
          p_days: days,
          p_delivery_at: deliveryDateObj.toISOString(),
          p_platform_bank_id: defaultBankId,
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
            p_platform_bank_id: defaultBankId,
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
            customer_phone: customerPhone.trim(),
            agency_ack_status: 'pending',
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
        customer_phone: customerPhone.trim(),
        agency_ack_status: 'pending',
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
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90dvh]">
        {/* Mobile grab handle */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1 bg-white shrink-0">
          <span className="w-10 h-1 rounded-full bg-slate-300" aria-hidden="true" />
        </div>

        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-100 bg-white shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-base sm:text-lg text-slate-900 truncate">
              {step === 'overview' && `${car.brand} ${car.model}`}
              {step === 'details' && 'بيانات السائق والاستلام'}
              {step === 'payment' && 'تحويل التسبيق (10%)'}
              {step === 'done' && 'تذكرة الحجز'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {getCityLabelAr(car.city)} · {car.agency_name}
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

        {/* Compact 4-Step Progress Bar */}
        <div className="grid grid-cols-4 border-b border-slate-100 text-[11px] sm:text-xs font-semibold text-center bg-slate-50/70 shrink-0">
          <div
            className={`py-2.5 px-1 ${
              step === 'overview'
                ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-white'
                : 'text-slate-500'
            }`}
          >
            1. السيارة
          </div>
          <div
            className={`py-2.5 px-1 ${
              step === 'details'
                ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-white'
                : 'text-slate-500'
            }`}
          >
            2. البيانات
          </div>
          <div
            className={`py-2.5 px-1 ${
              step === 'payment'
                ? 'text-[#2563EB] border-b-2 border-[#2563EB] bg-white'
                : 'text-slate-500'
            }`}
          >
            3. التحويل
          </div>
          <div
            className={`py-2.5 px-1 ${
              step === 'done'
                ? 'text-emerald-700 border-b-2 border-emerald-600 bg-white'
                : 'text-slate-500'
            }`}
          >
            4. التأكيد
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-pb-24 px-4 sm:px-6 py-4 pb-6">
          {/* STEP 1: CAR OVERVIEW */}
          {step === 'overview' && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <div className="aspect-[16/9] rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={car.primary_image_url}
                    alt={`${car.brand} ${car.model}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  صورة مرجعية للموديل من كتالوج المنصة — تطابق الموديل والمواصفات المحددة
                </p>
              </div>

              {/* Agency + Rating + Model Year */}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    {car.brand} {car.model} {car.model_year ? `· ${car.model_year}` : ''}
                    {car.color ? ` · ${car.color}` : ''}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{car.agency_name}</div>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold text-slate-800 shrink-0">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                  <span className="font-mono-tabular">{car.agency_rating.toFixed(1)}</span>
                  {car.agency_rating_count > 0 && (
                    <span className="text-slate-400 font-normal">({car.agency_rating_count})</span>
                  )}
                </div>
              </div>

              {/* Clean 4-Spec Icon Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/75 p-3 space-y-1">
                  <Fuel className="w-4 h-4 text-[#2563EB]" />
                  <div className="text-[11px] text-slate-500">الوقود</div>
                  <div className="text-xs font-bold text-slate-900">
                    {getFuelLabelAr(car.fuel_type)}
                  </div>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/75 p-3 space-y-1">
                  <Gauge className="w-4 h-4 text-[#2563EB]" />
                  <div className="text-[11px] text-slate-500">ناقل الحركة</div>
                  <div className="text-xs font-bold text-slate-900">
                    {car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}
                  </div>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/75 p-3 space-y-1">
                  <Users className="w-4 h-4 text-[#2563EB]" />
                  <div className="text-[11px] text-slate-500">السعة</div>
                  <div className="text-xs font-bold text-slate-900">{car.seats} مقاعد</div>
                </div>
                <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/75 p-3 space-y-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <div className="text-[11px] text-slate-500">الكفالة</div>
                  <div className="text-xs font-bold text-emerald-700">بدون ضمان (0 DH)</div>
                </div>
              </div>

              {/* Date, Time & Days Stepper (Minimum 3 days) */}
              <div className="rounded-xl bg-[#F8FAFC] border border-slate-200/75 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="overview-days"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      عدد الأيام (الحد الأدنى 3)
                    </label>
                    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-2 min-h-[42px]">
                      <button
                        type="button"
                        onClick={() => setDays((d) => Math.max(3, d - 1))}
                        disabled={days <= 3}
                        aria-label="تقليل الأيام"
                        className="w-8 h-8 rounded-lg hover:bg-slate-100 disabled:opacity-40 flex items-center justify-center text-slate-700"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        id="overview-days"
                        className="font-mono-tabular font-bold text-sm text-slate-900"
                      >
                        {days} {days <= 10 ? 'أيام' : 'يوماً'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDays((d) => Math.min(90, d + 1))}
                        aria-label="زيادة الأيام"
                        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-700"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="overview-pickup-date"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      تاريخ الاستلام
                    </label>
                    <input
                      id="overview-pickup-date"
                      type="date"
                      min={todayStr}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular focus:border-[#2563EB] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="overview-pickup-time"
                      className="block text-xs font-semibold text-slate-600 mb-1"
                    >
                      الوقت
                    </label>
                    <select
                      id="overview-pickup-time"
                      dir="ltr"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-center focus:border-[#2563EB] focus:outline-none"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Live Price Breakdown */}
                <div className="pt-3 border-t border-slate-200/75 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      الإجمالي ({days} × {car.daily_price} DH)
                    </span>
                    <span className="font-mono-tabular font-semibold text-slate-900">
                      {formatDH(totalAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm font-bold text-slate-900">
                    <span>تسبيق التأكيد الآن (10%)</span>
                    <span className="font-mono-tabular text-[#2563EB] text-base">
                      {formatDH(commissionAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>يُدفع للوكالة عند الاستلام (90%)</span>
                    <span className="font-mono-tabular font-semibold">
                      {formatDH(agencyPayoutAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-700 font-semibold pt-1">
                    <span>مبلغ الكفالة / الضمان</span>
                    <span>0.00 DH (بدون ضمان)</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStep('details')}
                className="w-full min-h-[48px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3.5 px-5 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm shadow-blue-600/15"
              >
                <span>متابعة الحجز</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* STEP 2: DRIVER DETAILS & PICKUP */}
          {step === 'details' && (
            <form onSubmit={handleCreateDraftBooking} className="space-y-4">
              <div className="rounded-xl bg-slate-50 border border-slate-200/80 px-3.5 py-2.5 text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <span>
                  للاستفادة من الكراء <strong>بدون ضمان (0 DH)</strong>: تشترط المنصة أقدمية رخصة سياقة لا تقل عن <strong>سنتين</strong>، وإحضار أصل البطاقة الوطنية ورخصة السياقة عند التسليم.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="booking-customer-name"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    الاسم الكامل
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
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-customer-cin"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    رقم البطاقة الوطنية (CIN)
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
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono uppercase focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-customer-phone"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    رقم الهاتف
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
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>

                <div>
                  <label
                    htmlFor="booking-license-number"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    رقم رخصة السياقة
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
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pr-3.5 pl-9 py-2.5 text-base sm:text-sm font-mono uppercase focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="booking-license-date"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    تاريخ إصدار الرخصة (سنتان+)
                  </label>
                  <input
                    id="booking-license-date"
                    required
                    type="date"
                    max={todayStr}
                    value={customerLicenseIssueDate}
                    onFocus={handleFieldFocus}
                    onChange={(e) => setCustomerLicenseIssueDate(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base sm:text-sm font-mono-tabular focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                  />
                </div>

                {licenseInfo && (
                  <div
                    className={`sm:col-span-2 text-xs px-3 py-2 rounded-lg border flex items-center gap-2 ${
                      !licenseInfo.valid
                        ? 'bg-red-50 border-red-200 text-red-700 font-semibold'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{licenseInfo.message}</span>
                  </div>
                )}

                <div className="sm:col-span-2 space-y-2">
                  <label
                    htmlFor="booking-pickup-location"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    مكان استلام السيارة داخل {getCityLabelAr(car.city)}
                  </label>

                  <button
                    type="button"
                    onClick={handleDetectCurrentLocation}
                    disabled={detectingLocation}
                    className={`w-full min-h-[46px] rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                      locationCoords
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70'
                        : 'border-[#2563EB]/35 bg-blue-50/70 text-[#2563EB] hover:bg-blue-100/70'
                    }`}
                  >
                    {detectingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                    <span>
                      {detectingLocation
                        ? 'جاري تحديد موقعك الحالي...'
                        : locationCoords
                          ? 'تم تحديد موقعك الحالي (تحديث)'
                          : 'حدد موقعك الحالي'}
                    </span>
                  </button>

                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="booking-pickup-location"
                      required
                      type="text"
                      placeholder="أو اكتب عنوانك الحالي في المدينة لتساعد الوكالة على التسليم"
                      value={pickupLocation}
                      onFocus={handleFieldFocus}
                      onChange={(e) => setPickupLocation(e.target.value)}
                      className="w-full min-h-[44px] rounded-xl border border-slate-200 bg-white pr-9 pl-3.5 py-2.5 text-base sm:text-sm focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15"
                    />
                  </div>

                  {locationNote && (
                    <p
                      className={`text-xs ${
                        locationCoords ? 'text-emerald-700 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {locationNote}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-start gap-2.5 rounded-xl border border-blue-200/80 bg-blue-50/50 p-3 text-xs text-slate-700 cursor-pointer select-none leading-relaxed">
                <input
                  type="checkbox"
                  checked={driverPledgeAccepted}
                  onChange={(e) => setDriverPledgeAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB] shrink-0"
                />
                <span>
                  أقر بصحة تاريخ إصدار رخصة السياقة (سنتان على الأقل)، وأوافق على أنه في حال عدم مطابقة أصل الرخصة أو البطاقة الوطنية عند التسليم يحق للوكالة رفض التسليم دون استرجاع التسبيق (10%).
                </span>
              </label>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-sm text-red-700 flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep('overview')}
                  className="min-h-[48px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-4 py-3 text-sm font-bold transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>رجوع</span>
                </button>

                <button
                  type="submit"
                  disabled={loading || (licenseInfo !== null && !licenseInfo.valid)}
                  className="flex-1 min-h-[48px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-5 font-bold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التجهيز...</span>
                    </>
                  ) : (
                    <>
                      <CalendarClock className="w-4 h-4" />
                      <span>الانتقال للدفع ({formatDH(commissionAmount)})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: BANK TRANSFER */}
          {step === 'payment' && createdBooking && (
            <BankTransferCheckout
              booking={createdBooking}
              onPaymentSubmitted={handlePaymentSubmitted}
              onBack={() => setStep('details')}
            />
          )}

          {/* STEP 4: DIGITAL BOOKING PASS */}
          {step === 'done' && createdBooking && (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h4 className="text-xl font-bold text-slate-900">تم استلام وصل التسبيق</h4>
                <p className="text-xs sm:text-sm text-slate-600 mt-1">
                  نراجع تحويلك عبر <span className="font-bold">{createdBooking.selected_bank_code}</span> وسنؤكد مع{' '}
                  <span className="font-bold">{createdBooking.agency_name}</span>.
                </p>
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] border border-slate-200/80 p-4 space-y-2.5">
                <div className="text-xs text-slate-500">كود تتبع الحجز</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono-tabular text-lg font-bold text-slate-900">
                    {createdBooking.booking_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyBookingCode}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-900 text-white px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 min-h-[36px]"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'نُسخ' : 'نسخ'}</span>
                  </button>
                </div>
                {createdBooking.pickup_location && (
                  <div className="text-xs text-slate-600">
                    الاستلام: <span className="font-semibold text-slate-800">{createdBooking.pickup_location}</span>
                  </div>
                )}
                <div className="text-xs font-bold text-emerald-700">
                  بدون ضمان · 0.00 DH كفالة
                </div>

                <div className="text-xs text-slate-600 pt-2 border-t border-slate-200/75 flex items-center justify-between">
                  <span>
                    التسبيق:{' '}
                    <strong className="font-mono-tabular text-slate-900">
                      {formatDH(createdBooking.commission_amount)}
                    </strong>
                  </span>
                  <span>
                    عند الاستلام:{' '}
                    <strong className="font-mono-tabular text-slate-900">
                      {formatDH(createdBooking.agency_payout_amount)}
                    </strong>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[48px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white py-3 font-bold text-sm transition-colors"
              >
                إغلاق والعودة للسيارات
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
