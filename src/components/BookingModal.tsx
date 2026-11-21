import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
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
  User,
  Phone,
  Calendar,
  FileCheck2,
  Clock,
} from 'lucide-react';
import {
  supabase,
  formatDH,
  getCityLabelAr,
  findNearestMoroccanCity,
} from '../lib/supabase';
import { STARTER_BANKS } from '../data/starterData';
import { BankTransferCheckout } from './BankTransferCheckout';
import { CarImage } from './CarImage';
import type { CarOffer, CreatedBooking, PlatformBank } from '../types/karya';

interface BookingModalProps {
  car: CarOffer;
  initialPickupDate?: string;
  initialDays?: number;
  onClose: () => void;
  onBookingCompleted: (booking: CreatedBooking) => void;
}

type StepKey = 'booking' | 'payment' | 'review';

const STEPS: { key: StepKey; label: string; number: number }[] = [
  { key: 'booking', label: 'بيانات الحجز', number: 1 },
  { key: 'payment', label: 'الدفع والوصل', number: 2 },
  { key: 'review', label: 'مراجعة وتأكيد', number: 3 },
];

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

function formatDateAr(dateStr: string, addDays = 0): string {
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  if (addDays > 0) {
    parsed.setDate(parsed.getDate() + addDays);
  }
  return parsed.toLocaleDateString('ar-MA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
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

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  threeYearsAgo.setHours(23, 59, 59, 999);

  if (parsed > threeYearsAgo) {
    return {
      valid: false,
      message:
        'يجب أن تكون لديك رخصة سياقة منذ 3 سنوات على الأقل (36 شهراً) للاستفادة من الكراء بدون ضمانة مالية.',
    };
  }

  const diffYears = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const wholeYears = Math.max(3, Math.floor(diffYears));

  return {
    valid: true,
    message: `رخصة سياقة منذ ${wholeYears} ${wholeYears >= 11 ? 'سنة' : 'سنوات'} (مستوفية للشروط).`,
  };
}

function getFuelLabelAr(fuel: CarOffer['fuel_type']): string {
  if (fuel === 'diesel') return 'ديزل';
  if (fuel === 'hybrid') return 'هجين';
  if (fuel === 'electric') return 'كهرباء';
  return 'بنزين';
}

interface FloatingFieldProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  type?: string;
  dir?: 'rtl' | 'ltr';
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  uppercase?: boolean;
  max?: string;
}

const FloatingField: React.FC<FloatingFieldProps> = ({
  id,
  label,
  icon,
  value,
  onChange,
  onFocus,
  type = 'text',
  dir = 'rtl',
  required = false,
  autoComplete,
  inputMode,
  uppercase = false,
  max,
}) => {
  const isDate = type === 'date';

  return (
    <div className="relative">
      <span
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10"
        aria-hidden="true"
      >
        {icon}
      </span>
      <input
        id={id}
        type={type}
        required={required}
        dir={dir}
        autoComplete={autoComplete}
        inputMode={inputMode}
        max={max}
        placeholder=" "
        value={value}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        className={`peer w-full min-h-[54px] rounded-lg border border-[var(--karya-border)] bg-white pr-10 pl-3.5 pt-5 pb-1.5 text-sm font-semibold text-[var(--karya-text)] transition-colors focus:border-[var(--karya-action)] focus:outline-none focus:ring-2 focus:ring-[var(--karya-action)]/15 ${
          dir === 'ltr' ? 'font-mono text-left' : ''
        } ${uppercase ? 'uppercase' : ''}`}
      />
      <label
        htmlFor={id}
        className={`pointer-events-none absolute right-10 transition-all duration-150 ${
          isDate
            ? 'top-1.5 text-[11px] font-bold text-[var(--karya-text-muted)]'
            : 'top-1.5 text-[11px] font-bold text-[var(--karya-text-muted)] peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-xs peer-placeholder-shown:font-semibold peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-[11px] peer-focus:font-bold peer-focus:text-[var(--karya-action)]'
        }`}
      >
        {label}
      </label>
    </div>
  );
};

export const BookingModal: React.FC<BookingModalProps> = ({
  car,
  initialPickupDate,
  initialDays,
  onClose,
  onBookingCompleted,
}) => {
  const todayStr = useMemo(() => getTodayDateString(), []);

  const [step, setStep] = useState<StepKey>('booking');

  // Step 1 state: booking settings & customer details
  const [days, setDays] = useState(() =>
    initialDays && initialDays >= 3 && initialDays <= 90 ? initialDays : 3,
  );
  const [pickupDate, setPickupDate] = useState(() =>
    initialPickupDate && initialPickupDate >= todayStr
      ? initialPickupDate
      : getDefaultPickupDateString(),
  );
  const [pickupTime, setPickupTime] = useState('10:00');

  const [customerName, setCustomerName] = useState('');
  const [customerCin, setCustomerCin] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerLicenseNumber, setCustomerLicenseNumber] = useState('');
  const [customerLicenseIssueDate, setCustomerLicenseIssueDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('');
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationNote, setLocationNote] = useState<string | null>(null);
  const [driverPledgeAccepted, setDriverPledgeAccepted] = useState(false);

  // Step 2 state: banks & receipt upload (persisted across back/forward navigation)
  const [banks, setBanks] = useState<PlatformBank[]>(STARTER_BANKS);
  const [selectedBank, setSelectedBank] = useState<PlatformBank>(STARTER_BANKS[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Step 3 state: submission & final success
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] = useState<CreatedBooking | null>(null);
  const [draftSignature, setDraftSignature] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const modalBodyRef = useRef<HTMLDivElement | null>(null);

  // Lock background scroll cleanly while modal is mounted
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, []);

  // Load active platform banks once
  useEffect(() => {
    let mounted = true;
    const loadBanks = async () => {
      try {
        const { data, error } = await supabase
          .from('platform_banks')
          .select('*')
          .eq('is_active', true)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0 && mounted) {
          const list = data as PlatformBank[];
          setBanks(list);
          setSelectedBank((prev) => list.find((b) => b.id === prev.id) || list[0]);
        }
      } catch {
        // Fallback smoothly to STARTER_BANKS
      }
    };
    loadBanks();
    return () => {
      mounted = false;
    };
  }, []);

  // Revoke object URL on cleanup
  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  // Reset modal scroll position cleanly when switching steps
  useEffect(() => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
    }
  }, [step, submittedSuccess]);

  const activeStepIndex = STEPS.findIndex((s) => s.key === step);
  const resolvedPickupLocation = pickupLocation.trim();

  const licenseInfo = useMemo(
    () => getLicenseSeniorityInfo(customerLicenseIssueDate),
    [customerLicenseIssueDate],
  );

  const totalAmount = Number((car.daily_price * days).toFixed(2));
  const commissionAmount = Number((totalAmount * 0.1).toFixed(2));
  const agencyPayoutAmount = Number((totalAmount - commissionAmount).toFixed(2));
  const returnDateLabel = useMemo(() => formatDateAr(pickupDate, days), [pickupDate, days]);
  const pickupDateLabel = useMemo(() => formatDateAr(pickupDate, 0), [pickupDate]);

  const currentBookingSignature = useMemo(
    () =>
      JSON.stringify({
        carId: car.id,
        days,
        pickupDate,
        pickupTime,
        name: customerName.trim(),
        cin: customerCin.trim().toUpperCase(),
        phone: customerPhone.trim(),
        license: customerLicenseNumber.trim().toUpperCase(),
        issueDate: customerLicenseIssueDate,
        pickupLocation: resolvedPickupLocation,
      }),
    [
      car.id,
      days,
      pickupDate,
      pickupTime,
      customerName,
      customerCin,
      customerPhone,
      customerLicenseNumber,
      customerLicenseIssueDate,
      resolvedPickupLocation,
    ],
  );

  const handleFieldFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const container = modalBodyRef.current;
    const target = e.currentTarget;
    if (!container) return;

    window.setTimeout(() => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const offsetTop = targetRect.top - containerRect.top;
      if (offsetTop < 24 || targetRect.bottom > containerRect.bottom - 24) {
        container.scrollTo({
          top: Math.max(0, container.scrollTop + offsetTop - 80),
          behavior: 'smooth',
        });
      }
    }, 180);
  };

  const handleDetectCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNote('المتصفح لا يدعم تحديد الموقع، اكتب عنوان الاستلام أدناه.');
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
        setLocationNote('تعذر الوصول للموقع تلقائياً، يرجى كتابة عنوان الاستلام أدناه.');
        setDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleReceiptSelected = (file: File | null, previewUrl: string | null) => {
    if (receiptPreviewUrl && receiptPreviewUrl !== previewUrl) {
      URL.revokeObjectURL(receiptPreviewUrl);
    }
    setReceiptFile(file);
    setReceiptPreviewUrl(previewUrl);
  };

  // Step 1 -> Step 2 validation
  const handleContinueToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (days < 3) {
      setErrorMsg('الحد الأدنى للكراء في المنصة هو 3 أيام.');
      return;
    }

    if (!pickupDate || !pickupTime) {
      setErrorMsg('يرجى تحديد تاريخ ووقت الاستلام.');
      return;
    }

    const deliveryDateObj = new Date(`${pickupDate}T${pickupTime}`);
    if (Number.isNaN(deliveryDateObj.getTime())) {
      setErrorMsg('تاريخ أو وقت الاستلام غير صالح.');
      return;
    }

    if (
      !customerName.trim() ||
      !customerCin.trim() ||
      !customerPhone.trim() ||
      !customerLicenseNumber.trim() ||
      !customerLicenseIssueDate
    ) {
      setErrorMsg('يرجى ملء جميع بيانات السائق والتواصل المطلوبة.');
      return;
    }

    const phoneDigits = customerPhone.replace(/[^0-9]/g, '');
    if (phoneDigits.length < 8) {
      setErrorMsg('يرجى إدخال رقم هاتف صحيح للتواصل بخصوص الحجز.');
      return;
    }

    if (customerCin.trim().length < 4) {
      setErrorMsg('يرجى إدخال رقم البطاقة الوطنية (CIN) بشكل صحيح.');
      return;
    }

    if (!licenseInfo || !licenseInfo.valid) {
      setErrorMsg(
        licenseInfo?.message ||
          'يجب أن تكون لديك رخصة سياقة منذ 3 سنوات على الأقل (36 شهراً) للاستفادة من الكراء بدون ضمانة مالية.',
      );
      return;
    }

    if (!resolvedPickupLocation) {
      setErrorMsg('يرجى تحديد موقعك الحالي أو كتابة عنوان الاستلام.');
      return;
    }

    if (!driverPledgeAccepted) {
      setErrorMsg(
        'يرجى تأكيد الإقرار بصحة رخصة السياقة (منذ 3 سنوات+) والبطاقة الوطنية قبل المتابعة.',
      );
      return;
    }

    setStep('payment');
  };

  // Step 2 -> Step 3 validation
  const handleContinueToReview = () => {
    setErrorMsg(null);
    setFileError(null);

    if (!receiptFile) {
      setFileError(
        'يرجى إرفاق وصل التحويل البنكي بصيغة JPG أو PNG أو PDF (الحد الأقصى 5MB) قبل المتابعة.',
      );
      return;
    }

    setStep('review');
  };

  // Step 3 final submission: create booking (idempotent on retry) -> upload receipt -> submit receipt
  const handleFinalSubmitBooking = async () => {
    if (submittingRef.current || submitting || submittedSuccess) return;

    if (!receiptFile) {
      setErrorMsg('وصل التحويل البنكي مفقود. يرجى العودة وإرفاق الوصل.');
      return;
    }

    const deliveryAtLocal = `${pickupDate}T${pickupTime}`;
    const deliveryDateObj = new Date(deliveryAtLocal);
    if (Number.isNaN(deliveryDateObj.getTime())) {
      setErrorMsg('تاريخ أو وقت الاستلام غير صالح.');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMsg(null);

    const packedNotes = [
      `مكان الاستلام: ${resolvedPickupLocation}`,
      `رخصة السياقة: ${customerLicenseNumber.trim().toUpperCase()}`,
      `تاريخ الإصدار: ${customerLicenseIssueDate}`,
    ].join(' | ');

    try {
      let activeBooking = createdBooking;

      if (car.is_demo) {
        if (!activeBooking || draftSignature !== currentBookingSignature) {
          activeBooking = {
            booking_id: crypto.randomUUID(),
            booking_code: `KRY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
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
          setCreatedBooking(activeBooking);
          setDraftSignature(currentBookingSignature);
        }

        const completedDemoBooking: CreatedBooking = {
          ...activeBooking,
          status: 'payment_uploaded',
          selected_bank_code: selectedBank.short_name,
          receipt_url: `local://${activeBooking.booking_code}/${receiptFile.name}`,
        };

        setCreatedBooking(completedDemoBooking);
        setSubmittedSuccess(true);
        onBookingCompleted(completedDemoBooking);
        return;
      }

      // If user edited details after a previous failed attempt, cancel stale draft first
      if (
        activeBooking &&
        !activeBooking.is_demo &&
        activeBooking.status === 'pending_payment' &&
        draftSignature !== currentBookingSignature
      ) {
        try {
          await supabase.rpc('cancel_pending_booking', {
            p_booking_id: activeBooking.booking_id,
            p_booking_code: activeBooking.booking_code,
          });
        } catch {
          // Ignore if RPC unavailable
        }
        activeBooking = null;
        setCreatedBooking(null);
        setDraftSignature(null);
      }

      // 1. Create booking draft only if we don't already have an active draft for these exact details
      if (!activeBooking) {
        let rpcResult = await supabase.rpc('create_booking', {
          p_agency_car_id: car.id,
          p_customer_name: customerName.trim(),
          p_customer_cin: customerCin.trim().toUpperCase(),
          p_customer_phone: customerPhone.trim(),
          p_days: days,
          p_delivery_at: deliveryDateObj.toISOString(),
          p_platform_bank_id: selectedBank.id,
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
            p_platform_bank_id: selectedBank.id,
            p_delivery_notes: packedNotes,
          });
        }

        if (rpcResult.error) {
          throw new Error(rpcResult.error.message);
        }

        if (!rpcResult.data || !rpcResult.data[0]) {
          throw new Error('تعذر إنشاء طلب الحجز، يرجى المحاولة مرة أخرى.');
        }

        const row = rpcResult.data[0];
        activeBooking = {
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

        setCreatedBooking(activeBooking);
        setDraftSignature(currentBookingSignature);
      }

      // 2. Upload receipt file to payment-receipts bucket
      const ext = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg';
      const objectPath = `receipts/${activeBooking.booking_code}_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('payment-receipts')
        .upload(objectPath, receiptFile, { upsert: true });

      if (uploadErr) {
        throw new Error(`تعذر رفع وصل التحويل: ${uploadErr.message}`);
      }

      // 3. Submit payment receipt on the booking
      const { error: submitErr } = await supabase.rpc('submit_payment_receipt', {
        p_booking_id: activeBooking.booking_id,
        p_booking_code: activeBooking.booking_code,
        p_platform_bank_id: selectedBank.id,
        p_receipt_url: objectPath,
      });

      if (submitErr && !submitErr.message.includes('Could not find the function')) {
        throw new Error(submitErr.message);
      }

      const finalBooking: CreatedBooking = {
        ...activeBooking,
        status: 'payment_uploaded',
        selected_bank_code: selectedBank.short_name,
        receipt_url: objectPath,
      };

      setCreatedBooking(finalBooking);
      setSubmittedSuccess(true);
      onBookingCompleted(finalBooking);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر إرسال طلب الحجز، يرجى التحقق من الاتصال والمحاولة مرة أخرى.',
      );
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const copyBookingCode = async () => {
    if (!createdBooking) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(createdBooking.booking_code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = createdBooking.booking_code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      setCopiedCode(false);
    }
  };

  const handleCloseModal = () => {
    if (submitting) return;
    if (
      createdBooking &&
      !createdBooking.is_demo &&
      !submittedSuccess &&
      createdBooking.status === 'pending_payment'
    ) {
      Promise.resolve(
        supabase.rpc('cancel_pending_booking', {
          p_booking_id: createdBooking.booking_id,
          p_booking_code: createdBooking.booking_code,
        }),
      ).catch(() => {});
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-[#0F283D]/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5 overflow-hidden overscroll-none"
      dir="rtl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-[var(--karya-surface)] w-full max-w-xl h-[100dvh] sm:h-auto sm:max-h-[90dvh] rounded-none sm:rounded-2xl shadow-2xl border-0 sm:border sm:border-[var(--karya-border)] overflow-hidden flex flex-col">
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-[var(--karya-border)] bg-white shrink-0">
          <div className="min-w-0">
            <h3
              id="booking-modal-title"
              className="font-extrabold text-base sm:text-lg text-[var(--karya-primary)] truncate"
            >
              {submittedSuccess
                ? 'تم استلام طلب الحجز بنجاح'
                : step === 'booking'
                  ? 'بيانات الحجز'
                  : step === 'payment'
                    ? 'دفع 10% لتأكيد الحجز'
                    : 'مراجعة وتأكيد الطلب'}
            </h3>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleCloseModal}
            aria-label="إغلاق نافذة الحجز"
            className="min-h-[42px] min-w-[42px] rounded-lg flex items-center justify-center text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] hover:bg-[var(--karya-bg)] disabled:opacity-50 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3-Step Progress Indicator */}
        {!submittedSuccess && (
          <div className="px-5 sm:px-8 py-3.5 bg-[var(--karya-bg)] border-b border-[var(--karya-border)] shrink-0">
            <div className="relative flex items-center justify-between">
              <div
                className="absolute top-4 right-6 left-6 h-0.5 bg-slate-200 overflow-hidden"
                aria-hidden="true"
              >
                <div
                  className="h-full bg-[var(--karya-action)] transition-all duration-300"
                  style={{
                    width: `${(activeStepIndex / (STEPS.length - 1)) * 100}%`,
                  }}
                />
              </div>

              {STEPS.map((s, idx) => {
                const isCompleted = idx < activeStepIndex;
                const isActive = idx === activeStepIndex;

                return (
                  <div
                    key={s.key}
                    className="relative z-10 flex flex-col items-center gap-1"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold transition-all ${
                        isCompleted
                          ? 'bg-[var(--karya-action)] text-white shadow-xs'
                          : isActive
                            ? 'bg-[var(--karya-primary)] text-white ring-4 ring-[#173B57]/15 shadow-xs'
                            : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <span className="font-mono-tabular">{s.number}</span>
                      )}
                    </div>
                    <span
                      className={`text-[11px] font-bold whitespace-nowrap ${
                        isCompleted
                          ? 'text-[var(--karya-action)]'
                          : isActive
                            ? 'text-[var(--karya-primary)]'
                            : 'text-slate-400'
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div
          ref={modalBodyRef}
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 sm:py-5 space-y-5 bg-[var(--karya-surface)]"
        >
          {/* STEP 1: BOOKING DATA (CAR SUMMARY + DATES/DURATION + CUSTOMER INFO) */}
          {step === 'booking' && (
            <form
              id="booking-step1-form"
              noValidate
              onSubmit={handleContinueToPayment}
              className="space-y-5"
            >
              {/* Compact Car Summary with Collapsible Secondary Details */}
              <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-bg)] p-3.5 space-y-3">
                <div className="flex items-start gap-3">
                  <CarImage
                    src={car.primary_image_url}
                    brand={car.brand}
                    model={car.model}
                    alt={`${car.brand} ${car.model}`}
                    className="w-24 h-[68px] sm:w-28 sm:h-20 rounded-lg object-cover border border-[var(--karya-border)] bg-white shrink-0"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-extrabold text-sm sm:text-base text-[var(--karya-primary)] truncate">
                        {car.brand} {car.model}
                      </h4>
                      {car.agency_rating_count > 0 && car.agency_rating > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--karya-primary)] shrink-0">
                          <Star className="w-3.5 h-3.5 fill-[#D49A42] text-[#D49A42]" />
                          <span className="font-mono-tabular">{car.agency_rating.toFixed(1)}</span>
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-[var(--karya-text-muted)] truncate">
                      {car.agency_name} · {getCityLabelAr(car.city)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-[var(--karya-text)] pt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Fuel className="w-3 h-3 text-[var(--karya-text-muted)]" />
                        <span>{getFuelLabelAr(car.fuel_type)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="w-3 h-3 text-[var(--karya-text-muted)]" />
                        <span>{car.transmission === 'automatic' ? 'أوتوماتيك' : 'يدوي'}</span>
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-[var(--karya-text-muted)]" />
                        <span>{car.seats} مقاعد</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[var(--karya-border)]">
                  <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--karya-action-soft)] text-[var(--karya-primary)] px-2.5 py-1 text-[11px] font-extrabold">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--karya-action)]" />
                    <span>بدون ضمانة مالية</span>
                  </span>
                </div>
              </div>

              {/* Booking Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-extrabold text-[var(--karya-primary)]">
                  إعدادات الحجز
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="overview-pickup-date"
                      className="block text-xs font-bold text-[var(--karya-primary)] mb-1"
                    >
                      تاريخ الاستلام
                    </label>
                    <input
                      id="overview-pickup-date"
                      type="date"
                      dir="ltr"
                      min={todayStr}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="date-input-centered w-full min-h-[46px] rounded-lg border border-[var(--karya-border)] bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-center focus:border-[var(--karya-action)] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="overview-pickup-time"
                      className="block text-xs font-bold text-[var(--karya-primary)] mb-1"
                    >
                      وقت الاستلام
                    </label>
                    <select
                      id="overview-pickup-time"
                      dir="ltr"
                      value={pickupTime}
                      onChange={(e) => setPickupTime(e.target.value)}
                      className="w-full min-h-[46px] rounded-lg border border-[var(--karya-border)] bg-white px-3 py-2 text-xs sm:text-sm font-mono-tabular text-center focus:border-[var(--karya-action)] focus:outline-none"
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label
                      htmlFor="overview-days"
                      className="block text-xs font-bold text-[var(--karya-primary)] mb-1"
                    >
                      مدة الكراء (أقل مدة 3)
                    </label>
                    <div className="flex items-center justify-between rounded-lg border border-[var(--karya-border)] bg-white px-2 min-h-[46px]">
                      <button
                        type="button"
                        onClick={() => setDays((d) => Math.max(3, d - 1))}
                        disabled={days <= 3}
                        aria-label="تقليل الأيام"
                        className="w-9 h-9 rounded-md hover:bg-[var(--karya-bg)] disabled:opacity-40 flex items-center justify-center text-[var(--karya-primary)]"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span
                        id="overview-days"
                        className="font-mono-tabular font-extrabold text-sm text-[var(--karya-primary)]"
                      >
                        {days} {days <= 10 ? 'أيام' : 'يوماً'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDays((d) => Math.min(90, d + 1))}
                        aria-label="زيادة الأيام"
                        className="w-9 h-9 rounded-md hover:bg-[var(--karya-bg)] flex items-center justify-center text-[var(--karya-primary)]"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Info */}
              <div className="space-y-3 pt-1 border-t border-[var(--karya-border)]">
                <h4 className="text-sm font-extrabold text-[var(--karya-primary)] pt-1">
                  معلومات الزبون
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <FloatingField
                      id="booking-customer-name"
                      label="الاسم الكامل"
                      icon={<User className="w-4 h-4" />}
                      value={customerName}
                      onChange={setCustomerName}
                      onFocus={handleFieldFocus}
                      autoComplete="name"
                      required
                    />
                  </div>

                  <FloatingField
                    id="booking-customer-phone"
                    label="رقم الهاتف"
                    icon={<Phone className="w-4 h-4" />}
                    value={customerPhone}
                    onChange={setCustomerPhone}
                    onFocus={handleFieldFocus}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    dir="ltr"
                    required
                  />

                  <FloatingField
                    id="booking-customer-cin"
                    label="رقم البطاقة الوطنية (CIN)"
                    icon={<CreditCard className="w-4 h-4" />}
                    value={customerCin}
                    onChange={setCustomerCin}
                    onFocus={handleFieldFocus}
                    dir="ltr"
                    uppercase
                    required
                  />

                  <FloatingField
                    id="booking-license-number"
                    label="رقم رخصة السياقة"
                    icon={<CreditCard className="w-4 h-4" />}
                    value={customerLicenseNumber}
                    onChange={setCustomerLicenseNumber}
                    onFocus={handleFieldFocus}
                    dir="ltr"
                    uppercase
                    required
                  />

                  <FloatingField
                    id="booking-license-date"
                    label="تاريخ إصدار الرخصة (منذ 3 سنوات+)"
                    icon={<Calendar className="w-4 h-4" />}
                    value={customerLicenseIssueDate}
                    onChange={setCustomerLicenseIssueDate}
                    onFocus={handleFieldFocus}
                    type="date"
                    max={todayStr}
                    required
                  />

                  {licenseInfo && (
                    <div
                      className={`sm:col-span-2 text-xs px-3.5 py-2 rounded-lg border flex items-center gap-2 ${
                        !licenseInfo.valid
                          ? 'bg-red-50 border-red-200 text-red-700 font-bold'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800 font-semibold'
                      }`}
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{licenseInfo.message}</span>
                    </div>
                  )}

                  <div className="sm:col-span-2 space-y-2 pt-1">
                    <FloatingField
                      id="booking-pickup-location"
                      label={`عنوان الاستلام داخل ${getCityLabelAr(car.city)}`}
                      icon={<MapPin className="w-4 h-4" />}
                      value={pickupLocation}
                      onChange={setPickupLocation}
                      onFocus={handleFieldFocus}
                      required
                    />

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={handleDetectCurrentLocation}
                        disabled={detectingLocation}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                          locationCoords
                            ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] text-[var(--karya-primary)]'
                            : 'border-[var(--karya-border)] bg-[var(--karya-bg)] text-[var(--karya-primary)] hover:bg-slate-200/70'
                        }`}
                      >
                        {detectingLocation ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Navigation className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {detectingLocation
                            ? 'جاري تحديد موقعك...'
                            : locationCoords
                              ? 'تحديث موقعي الحالي'
                              : 'استخدام موقعي الحالي (GPS)'}
                        </span>
                      </button>

                      {locationNote && (
                        <span
                          className={`text-[11px] ${
                            locationCoords
                              ? 'text-[var(--karya-action)] font-semibold'
                              : 'text-[var(--karya-text-muted)]'
                          }`}
                        >
                          {locationNote}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <label className="flex items-start gap-2.5 rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] p-3 text-xs text-[var(--karya-text)] cursor-pointer select-none leading-relaxed">
                  <input
                    type="checkbox"
                    checked={driverPledgeAccepted}
                    onChange={(e) => setDriverPledgeAccepted(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[var(--karya-action)] focus:ring-[var(--karya-action)] shrink-0"
                  />
                  <span>
                    أقرّ بصحة تاريخ رخصة السياقة (منذ 3 سنوات على الأقل) وتقديم البطاقة الوطنية وتوقيع عقد الكراء عند الاستلام.
                  </span>
                </label>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 flex items-center gap-2 font-semibold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </form>
          )}

          {/* STEP 2: 10% PAYMENT & RECEIPT UPLOAD */}
          {step === 'payment' && (
            <BankTransferCheckout
              dailyPrice={car.daily_price}
              days={days}
              totalAmount={totalAmount}
              commissionAmount={commissionAmount}
              agencyPayoutAmount={agencyPayoutAmount}
              banks={banks}
              selectedBank={selectedBank}
              onSelectBank={setSelectedBank}
              receiptFile={receiptFile}
              receiptPreviewUrl={receiptPreviewUrl}
              fileError={fileError}
              onReceiptSelected={handleReceiptSelected}
              onFileError={setFileError}
            />
          )}

          {/* STEP 3: REVIEW & CONFIRM (BEFORE SUBMIT) */}
          {step === 'review' && !submittedSuccess && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-bg)] divide-y divide-[var(--karya-border)] text-xs sm:text-sm">
                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">السيارة المختارة</span>
                  <span className="font-extrabold text-[var(--karya-primary)]">
                    {car.brand} {car.model}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">الوكالة الشريكة والمدينة</span>
                  <span className="font-bold text-[var(--karya-text)]">
                    {car.agency_name} · {getCityLabelAr(car.city)}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">تاريخ ووقت الاستلام</span>
                  <span className="font-bold text-[var(--karya-text)] font-mono-tabular">
                    {pickupDateLabel} — {pickupTime}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">مدة الكراء</span>
                  <span className="font-bold text-[var(--karya-text)]">
                    {days} {days <= 10 ? 'أيام' : 'يوماً'} (حتى {returnDateLabel})
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">الإجمالي الكلي</span>
                  <span className="font-mono-tabular font-bold text-[var(--karya-text)]">
                    {formatDH(totalAmount)}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3 bg-[var(--karya-action-soft)]/50">
                  <span className="font-extrabold text-[var(--karya-primary)]">
                    مبلغ تأكيد الحجز (10%)
                  </span>
                  <span className="font-mono-tabular font-extrabold text-[var(--karya-action)]">
                    {formatDH(commissionAmount)}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">
                    المبلغ المتبقي عند استلام السيارة (90%)
                  </span>
                  <span className="font-mono-tabular font-bold text-[var(--karya-primary)]">
                    {formatDH(agencyPayoutAmount)}
                  </span>
                </div>

                <div className="px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[var(--karya-text-muted)]">حالة إرفاق الوصل</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 text-xs max-w-[60%] truncate">
                    <FileCheck2 className="w-4 h-4 shrink-0" />
                    <span className="truncate">
                      {receiptFile ? `${receiptFile.name} (${selectedBank.short_name})` : 'غير مرفق'}
                    </span>
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)] px-3.5 py-2.5 text-xs text-[var(--karya-text-muted)] leading-relaxed flex items-start gap-2">
                <Clock className="w-4 h-4 text-[var(--karya-action)] shrink-0 mt-0.5" />
                <span>
                  بعد إرسال طلب الحجز، تتم مراجعة وصل التحويل والتحقق من توفر السيارة مع الوكالة الشريكة قبل التأكيد النهائي.
                </span>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 flex items-center gap-2 font-semibold"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* SUCCESS CONFIRMATION VIEW (ONLY AFTER ACTUAL SUBMISSION SUCCEEDS) */}
          {submittedSuccess && createdBooking && (
            <div className="text-center space-y-5 py-3">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-xl font-extrabold text-[var(--karya-primary)]">
                  تم استلام طلب الحجز بنجاح
                </h4>
                <p className="text-xs sm:text-sm text-[var(--karya-text-muted)] max-w-md mx-auto leading-relaxed">
                  تم استلام طلب الحجز بنجاح. سنوافيك بتحديث حالة طلبك بعد مراجعة الوكالة.
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 px-3 py-1.5 text-xs font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>قيد مراجعة الوكالة الشريكة والتحقق من وصل التحويل</span>
              </div>

              <div className="rounded-xl bg-[var(--karya-bg)] border border-[var(--karya-border)] p-4 space-y-3">
                <div className="text-xs text-[var(--karya-text-muted)]">رقم الحجز</div>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono-tabular text-lg font-extrabold text-[var(--karya-primary)]">
                    {createdBooking.booking_code}
                  </span>
                  <button
                    type="button"
                    onClick={copyBookingCode}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold min-h-[36px] transition-colors ${
                      copiedCode
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white'
                    }`}
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCode ? 'تم النسخ' : 'نسخ'}</span>
                  </button>
                </div>

                <div className="text-xs text-[var(--karya-text-muted)] pt-2.5 border-t border-[var(--karya-border)] flex flex-wrap items-center justify-between gap-2">
                  <span>
                    مبلغ تأكيد الحجز (10%):{' '}
                    <strong className="font-mono-tabular text-[var(--karya-action)]">
                      {formatDH(createdBooking.commission_amount)}
                    </strong>
                  </span>
                  <span>
                    المتبقي عند الاستلام:{' '}
                    <strong className="font-mono-tabular text-[var(--karya-primary)]">
                      {formatDH(createdBooking.agency_payout_amount)}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Modal Footer */}
        <div className="px-4 sm:px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] border-t border-[var(--karya-border)] bg-white shrink-0">
          {submittedSuccess ? (
            <button
              type="button"
              onClick={handleCloseModal}
              className="w-full min-h-[48px] rounded-lg bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white py-3 px-5 font-extrabold text-sm transition-colors"
            >
              إغلاق والعودة للسيارات
            </button>
          ) : step === 'booking' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseModal}
                className="min-h-[48px] rounded-lg border border-[var(--karya-border)] bg-white hover:bg-[var(--karya-bg)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] px-4 py-3 text-sm font-bold transition-colors shrink-0"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="booking-step1-form"
                disabled={licenseInfo !== null && !licenseInfo.valid}
                className="flex-1 min-h-[48px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 px-5 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>متابعة للدفع</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : step === 'payment' ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setStep('booking');
                }}
                className="min-h-[48px] rounded-lg border border-[var(--karya-border)] bg-white hover:bg-[var(--karya-bg)] text-[var(--karya-primary)] px-4 py-3 text-sm font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
                <span>رجوع</span>
              </button>
              <button
                type="button"
                onClick={handleContinueToReview}
                className="flex-1 min-h-[48px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white py-3 px-5 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <span>تأكيد الدفع وإرفاق الوصل</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setErrorMsg(null);
                  setStep('payment');
                }}
                className="min-h-[48px] rounded-lg border border-[var(--karya-border)] bg-white hover:bg-[var(--karya-bg)] disabled:opacity-50 text-[var(--karya-primary)] px-4 py-3 text-sm font-bold transition-colors flex items-center gap-1.5 shrink-0"
              >
                <ArrowRight className="w-4 h-4" />
                <span>رجوع للتعديل</span>
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinalSubmitBooking}
                className="flex-1 min-h-[48px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] disabled:opacity-65 disabled:cursor-not-allowed text-white py-3 px-5 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إرسال الطلب...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>إرسال طلب الحجز</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
