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
  ClipboardCheck,
  X,
  Copy,
  Check,
  Fuel,
  Gauge,
} from 'lucide-react';
import { supabase, formatDH, getCityLabelAr } from '../lib/supabase';
import type { BookingStatus, CreatedBooking } from '../types/karya';

const PICKUP_CHECKLIST_STORAGE_KEY = 'karya_pickup_checklist_v1';

interface PickupChecklistItemDef {
  id: string;
  title: string;
  hint: string;
}

const PICKUP_CHECKLIST_ITEMS: PickupChecklistItemDef[] = [
  {
    id: 'exterior_glass',
    title: 'الهيكل الخارجي والزجاج',
    hint: 'فحص الصدامات، الأبواب، المرايا والزجاج الأمامي، وتصوير أي خدوش سابقة أمام مسؤول الوكالة.',
  },
  {
    id: 'tires_spare',
    title: 'الإطارات والعجلة الاحتياطية',
    hint: 'التأكد من حالة الإطارات الأربعة ووجود العجلة الاحتياطية والرافعة ومفتاح العجلات.',
  },
  {
    id: 'lights_ac',
    title: 'الأضواء والمسّاحات والتكييف',
    hint: 'تجربة المصابيح الأمامية والخلفية، إشارات الانعطاف، المسّاحات، وعمل المكيف.',
  },
  {
    id: 'car_papers',
    title: 'الوثائق القانونية للسيارة',
    hint: 'التحقق من وجود البطاقة الرمادية، شهادة التأمين سارية المفعول، والفحص التقني داخل السيارة.',
  },
  {
    id: 'safety_kit',
    title: 'تجهيزات السلامة القانونية',
    hint: 'التأكد من توفر مثلث التحذير وسترة السلامة داخل الصندوق الخلفي.',
  },
  {
    id: 'contract_docs',
    title: 'العقد الرسمي والوثائق الشخصية',
    hint: 'تقديم البطاقة الوطنية ورخصة السياقة (3 سنوات+) وتوقيع عقد الكراء الرسمي مع الاحتفاظ بنسخة.',
  },
  {
    id: 'fuel_remaining_pay',
    title: 'تثبيت العداد والوقود ودفع الـ 90%',
    hint: 'تأكيد مستوى الوقود وقراءة العداد، وتسليم المبلغ المتبقي (90%) للوكالة بعد المعاينة.',
  },
];

type FuelLevelOption = '1/4' | '1/2' | '3/4' | '4/4';

interface PickupInspectionRecord {
  checkedIds: string[];
  odometerKm: string;
  fuelLevel: FuelLevelOption | '';
  notes: string;
  savedAt: string;
}

function loadAllChecklists(): Record<string, PickupInspectionRecord> {
  try {
    const raw = window.localStorage.getItem(PICKUP_CHECKLIST_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveChecklistForCode(code: string, record: PickupInspectionRecord): void {
  try {
    const all = loadAllChecklists();
    all[code] = record;
    window.localStorage.setItem(PICKUP_CHECKLIST_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Ignore storage quota errors
  }
}

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

  const [checklistsByCode, setChecklistsByCode] = useState<Record<string, PickupInspectionRecord>>(() =>
    loadAllChecklists(),
  );
  const [checklistTarget, setChecklistTarget] = useState<CreatedBooking | null>(null);
  const [draftCheckedIds, setDraftCheckedIds] = useState<string[]>([]);
  const [draftOdometer, setDraftOdometer] = useState('');
  const [draftFuelLevel, setDraftFuelLevel] = useState<FuelLevelOption | ''>('');
  const [draftNotes, setDraftNotes] = useState('');
  const [checklistSavedMsg, setChecklistSavedMsg] = useState<string | null>(null);
  const [checklistCopied, setChecklistCopied] = useState(false);

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

  const openChecklistForBooking = (booking: CreatedBooking) => {
    const existing = checklistsByCode[booking.booking_code];
    setChecklistTarget(booking);
    setDraftCheckedIds(existing?.checkedIds ?? []);
    setDraftOdometer(existing?.odometerKm ?? '');
    setDraftFuelLevel(existing?.fuelLevel ?? '');
    setDraftNotes(existing?.notes ?? '');
    setChecklistSavedMsg(null);
    setChecklistCopied(false);
  };

  const toggleChecklistItem = (itemId: string) => {
    setDraftCheckedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
    setChecklistSavedMsg(null);
  };

  const handleSaveChecklist = () => {
    if (!checklistTarget) return;
    const record: PickupInspectionRecord = {
      checkedIds: draftCheckedIds,
      odometerKm: draftOdometer.trim(),
      fuelLevel: draftFuelLevel,
      notes: draftNotes.trim(),
      savedAt: new Date().toISOString(),
    };
    saveChecklistForCode(checklistTarget.booking_code, record);
    setChecklistsByCode((prev) => ({
      ...prev,
      [checklistTarget.booking_code]: record,
    }));
    setChecklistSavedMsg('تم حفظ قائمة الفحص وحالة السيارة على جهازك بنجاح.');
  };

  const handleCopyChecklistSummary = async () => {
    if (!checklistTarget) return;
    const checkedTitles = PICKUP_CHECKLIST_ITEMS.filter((item) =>
      draftCheckedIds.includes(item.id),
    ).map((item) => `✓ ${item.title}`);
    const fuelLabels: Record<FuelLevelOption, string> = {
      '1/4': 'ربع (1/4)',
      '1/2': 'نصف (1/2)',
      '3/4': 'ثلاثة أرباع (3/4)',
      '4/4': 'ممتلئ (4/4)',
    };
    const summaryLines = [
      `توثيق استلام سيارة — منصة Karya`,
      `• رمز الحجز: ${checklistTarget.booking_code}`,
      `• السيارة: ${checklistTarget.car_label}`,
      `• الوكالة: ${checklistTarget.agency_name} (${getCityLabelAr(checklistTarget.city)})`,
      `• المبلغ المتبقي عند الاستلام (90%): ${formatDH(checklistTarget.agency_payout_amount)}`,
      draftOdometer.trim() ? `• قراءة العداد عند الاستلام: ${draftOdometer.trim()} كم` : '',
      draftFuelLevel ? `• مستوى الوقود: ${fuelLabels[draftFuelLevel]}` : '',
      `• البنود المفحوصة (${checkedTitles.length}/${PICKUP_CHECKLIST_ITEMS.length}):`,
      ...(checkedTitles.length > 0 ? checkedTitles : ['- لم يتم تأشير بنود بعد']),
      draftNotes.trim() ? `• ملاحظات الحالة: ${draftNotes.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(summaryLines);
      setChecklistCopied(true);
      window.setTimeout(() => setChecklistCopied(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
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

                    <div className="flex flex-wrap items-center gap-2">
                      {!['cancelled', 'refund_requested', 'refunded'].includes(booking.status) && (() => {
                        const savedChecklist = checklistsByCode[booking.booking_code];
                        const checkedCount = savedChecklist?.checkedIds.length ?? 0;
                        const totalItems = PICKUP_CHECKLIST_ITEMS.length;
                        const isComplete = checkedCount === totalItems;
                        return (
                          <button
                            type="button"
                            onClick={() => openChecklistForBooking(booking)}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 min-h-[38px] text-xs font-bold transition-colors whitespace-nowrap ${
                              isComplete
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'border-[var(--karya-action)]/30 bg-[var(--karya-action-soft)] text-[var(--karya-primary)] hover:bg-blue-100/60'
                            }`}
                          >
                            <ClipboardCheck
                              className={`w-3.5 h-3.5 ${
                                isComplete ? 'text-emerald-700' : 'text-[var(--karya-action)]'
                              }`}
                            />
                            <span>قائمة التحقق عند الاستلام</span>
                            {checkedCount > 0 && (
                              <span
                                className={`font-mono-tabular text-[11px] px-1.5 py-0.5 rounded ${
                                  isComplete
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-[var(--karya-primary)] text-white'
                                }`}
                              >
                                {checkedCount}/{totalItems}
                              </span>
                            )}
                          </button>
                        );
                      })()}

                      {refundEligibility.eligible && (
                        <button
                          type="button"
                          onClick={() => openRefundForBooking(booking)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 min-h-[38px] text-xs font-extrabold transition-colors whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>طلب استرجاع مبلغ التأكيد</span>
                        </button>
                      )}
                    </div>

                    {!refundEligibility.eligible && refundEligibility.blockedMessage && (
                      <div className="w-full text-[11px] text-[var(--karya-text-muted)] leading-relaxed">
                        {refundEligibility.blockedMessage}
                      </div>
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

      {/* Pickup Inspection Checklist Modal */}
      {checklistTarget && (
        <div
          className="fixed inset-0 z-50 bg-[#173B57]/60 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
          dir="rtl"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pickup-checklist-title"
          onClick={() => setChecklistTarget(null)}
        >
          <div
            className="bg-[var(--karya-surface)] w-full sm:max-w-xl h-[92dvh] sm:h-auto sm:max-h-[90vh] rounded-t-2xl sm:rounded-xl shadow-2xl border border-[var(--karya-border)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-[var(--karya-border)] flex items-start justify-between gap-3 bg-[var(--karya-surface)] shrink-0">
              <div className="space-y-1 min-w-0">
                <h2
                  id="pickup-checklist-title"
                  className="text-base sm:text-lg font-extrabold text-[var(--karya-primary)] flex items-center gap-2"
                >
                  <ClipboardCheck className="w-5 h-5 text-[var(--karya-action)] shrink-0" />
                  <span>قائمة التحقق عند الاستلام</span>
                </h2>
                <p className="text-xs text-[var(--karya-text-muted)] truncate">
                  {checklistTarget.car_label} · <span className="font-mono-tabular font-bold">{checklistTarget.booking_code}</span> · {checklistTarget.agency_name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setChecklistTarget(null)}
                aria-label="إغلاق قائمة التحقق"
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)] hover:bg-[var(--karya-bg)] shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-6 py-4 space-y-4">
              {/* Progress Bar */}
              <div className="rounded-lg bg-[var(--karya-bg)] border border-[var(--karya-border)] p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--karya-primary)]">
                    تقدم فحص السيارة وتوثيق الحالة
                  </span>
                  <span className="font-mono-tabular font-extrabold text-[var(--karya-action)]">
                    {draftCheckedIds.length} / {PICKUP_CHECKLIST_ITEMS.length}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      draftCheckedIds.length === PICKUP_CHECKLIST_ITEMS.length
                        ? 'bg-emerald-600'
                        : 'bg-[var(--karya-action)]'
                    }`}
                    style={{
                      width: `${Math.round((draftCheckedIds.length / PICKUP_CHECKLIST_ITEMS.length) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-[var(--karya-text-muted)] leading-relaxed">
                  افحص السيارة مع مسؤول الوكالة قبل تسليم المبلغ المتبقي (<strong className="text-[var(--karya-primary)] font-mono-tabular">{formatDH(checklistTarget.agency_payout_amount)}</strong>) وتوقيع العقد، لتفادي أي خلاف عند الإرجاع.
                </p>
              </div>

              {/* Checklist Items */}
              <div className="divide-y divide-[var(--karya-border)] rounded-xl border border-[var(--karya-border)] bg-[var(--karya-surface)] overflow-hidden">
                {PICKUP_CHECKLIST_ITEMS.map((item) => {
                  const checked = draftCheckedIds.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 p-3.5 cursor-pointer select-none transition-colors ${
                        checked ? 'bg-emerald-50/50' : 'hover:bg-[var(--karya-surface-muted)]'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleChecklistItem(item.id)}
                        className="mt-0.5 w-4.5 h-4.5 rounded border-slate-300 text-emerald-600 focus:ring-[var(--karya-action)] shrink-0"
                      />
                      <div className="min-w-0 space-y-0.5">
                        <div
                          className={`text-xs sm:text-sm font-bold ${
                            checked ? 'text-emerald-900' : 'text-[var(--karya-primary)]'
                          }`}
                        >
                          {item.title}
                        </div>
                        <p className="text-[11px] text-[var(--karya-text-muted)] leading-relaxed">
                          {item.hint}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Odometer & Fuel Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                <div>
                  <label
                    htmlFor="pickup-odometer-input"
                    className="flex items-center gap-1.5 text-xs font-bold text-[var(--karya-primary)] mb-1.5"
                  >
                    <Gauge className="w-3.5 h-3.5 text-[var(--karya-text-muted)]" />
                    <span>قراءة العداد عند الاستلام (كم)</span>
                  </label>
                  <input
                    id="pickup-odometer-input"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="مثال: 68420"
                    value={draftOdometer}
                    onChange={(e) => {
                      setDraftOdometer(e.target.value.replace(/[^0-9]/g, ''));
                      setChecklistSavedMsg(null);
                    }}
                    className="w-full min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] px-3.5 py-2 text-sm font-mono-tabular focus:bg-white focus:border-[var(--karya-action)] focus:outline-none"
                  />
                </div>

                <div>
                  <span className="flex items-center gap-1.5 text-xs font-bold text-[var(--karya-primary)] mb-1.5">
                    <Fuel className="w-3.5 h-3.5 text-[var(--karya-text-muted)]" />
                    <span>مستوى الوقود عند الاستلام</span>
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { value: '1/4', label: '1/4' },
                        { value: '1/2', label: '1/2' },
                        { value: '3/4', label: '3/4' },
                        { value: '4/4', label: 'ممتلئ' },
                      ] as const
                    ).map((opt) => {
                      const active = draftFuelLevel === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setDraftFuelLevel(active ? '' : opt.value);
                            setChecklistSavedMsg(null);
                          }}
                          className={`min-h-[44px] rounded-lg border text-xs font-bold transition-colors ${
                            active
                              ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] text-[var(--karya-primary)]'
                              : 'border-[var(--karya-border)] bg-[var(--karya-bg)] text-[var(--karya-text-muted)] hover:text-[var(--karya-primary)]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Condition / Scratches Notes */}
              <div>
                <label
                  htmlFor="pickup-notes-input"
                  className="block text-xs font-bold text-[var(--karya-primary)] mb-1.5"
                >
                  ملاحظات الحالة أو الخدوش الموجودة مسبقاً (اختياري)
                </label>
                <textarea
                  id="pickup-notes-input"
                  rows={2}
                  placeholder="مثال: خدش خفيف في الصدام الأمامي الأيسر تم تصويره بحضور مسؤول الوكالة..."
                  value={draftNotes}
                  onChange={(e) => {
                    setDraftNotes(e.target.value);
                    setChecklistSavedMsg(null);
                  }}
                  className="w-full rounded-lg border border-[var(--karya-border)] bg-[var(--karya-bg)] px-3.5 py-2.5 text-xs sm:text-sm focus:bg-white focus:border-[var(--karya-action)] focus:outline-none"
                />
              </div>

              {checklistSavedMsg && (
                <div
                  role="status"
                  className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 text-xs font-bold text-emerald-800 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{checklistSavedMsg}</span>
                </div>
              )}

              {checklistsByCode[checklistTarget.booking_code]?.savedAt && !checklistSavedMsg && (
                <p className="text-[11px] text-[var(--karya-text-muted)]">
                  آخر توثيق محفوظ:{' '}
                  {new Date(checklistsByCode[checklistTarget.booking_code].savedAt).toLocaleString('ar-MA')}
                </p>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 sm:px-6 py-3.5 border-t border-[var(--karya-border)] bg-[var(--karya-surface)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleCopyChecklistSummary}
                className="min-h-[44px] rounded-lg border border-[var(--karya-border)] bg-[var(--karya-surface)] hover:bg-[var(--karya-bg)] text-[var(--karya-primary)] px-4 py-2 text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
              >
                {checklistCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" />
                    <span>تم نسخ ملخص الفحص</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-[var(--karya-text-muted)]" />
                    <span>نسخ ملخص التوثيق</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSaveChecklist}
                className="min-h-[44px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white px-5 py-2.5 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>حفظ قائمة التحقق</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
