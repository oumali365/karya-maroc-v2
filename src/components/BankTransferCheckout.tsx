import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Landmark,
  ShieldCheck,
  Upload,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { supabase, formatDH } from '../lib/supabase';
import { STARTER_BANKS } from '../data/starterData';
import { BankLogo } from './BankLogo';
import type { CreatedBooking, PlatformBank } from '../types/karya';

interface BankTransferCheckoutProps {
  booking: CreatedBooking;
  onPaymentSubmitted: (updatedBooking: CreatedBooking) => void;
  onBack?: () => void;
}

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);

export const BankTransferCheckout: React.FC<BankTransferCheckoutProps> = ({
  booking,
  onPaymentSubmitted,
  onBack,
}) => {
  const [banks, setBanks] = useState<PlatformBank[]>(STARTER_BANKS);
  const [selectedBank, setSelectedBank] = useState<PlatformBank>(STARTER_BANKS[0]);
  const [copiedRib, setCopiedRib] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const submittingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
          setBanks(data as PlatformBank[]);
          setSelectedBank(data[0] as PlatformBank);
        }
      } catch {
        // Fallback smoothly to STARTER_BANKS if platform_banks table isn't migrated yet
      }
    };
    loadBanks();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    };
  }, [receiptPreviewUrl]);

  const handleSelectBank = (bank: PlatformBank) => {
    setSelectedBank(bank);
    setCopiedRib(false);
  };

  const handleCopyRib = async () => {
    const cleanRib = selectedBank.rib.replace(/\s+/g, '');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanRib);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = cleanRib;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedRib(true);
      window.setTimeout(() => setCopiedRib(false), 2500);
    } catch {
      setCopiedRib(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setFileError(null);

    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const hasValidMime = file.type ? ALLOWED_MIME_TYPES.has(file.type.toLowerCase()) : false;
    const hasValidExt = ALLOWED_EXTENSIONS.has(ext);

    if (!hasValidMime && !hasValidExt) {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      event.target.value = '';
      setFileError(
        'صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة JPG أو PNG أو ملف PDF فقط.',
      );
      return;
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      event.target.value = '';
      setFileError(
        'صيغة الملف غير مدعومة. يرجى اختيار صورة بصيغة JPG أو PNG أو ملف PDF فقط.',
      );
      return;
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      event.target.value = '';
      setFileError(
        `حجم الملف (${sizeMb} MB) يتجاوز الحد الأقصى المسموح به وهو 5 ميجابايت (5MB).`,
      );
      return;
    }

    if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
    setReceiptFile(file);
    if (file.type.startsWith('image/') || ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      setReceiptPreviewUrl(URL.createObjectURL(file));
    } else {
      setReceiptPreviewUrl(null);
    }
  };

  const handleConfirmPayment = async () => {
    if (submittingRef.current || submitting) return;

    if (!receiptFile) {
      setFileError('يرجى إرفاق وصل التحويل البنكي بصيغة JPG أو PNG أو PDF (الحد الأقصى 5MB).');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setErrorMsg(null);
    setFileError(null);

    try {
      let storedReceiptPath = `local://${booking.booking_code}/${receiptFile.name}`;

      if (!booking.is_demo) {
        const ext = receiptFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const objectPath = `receipts/${booking.booking_code}_${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('payment-receipts')
          .upload(objectPath, receiptFile, { upsert: true });

        if (!uploadErr) {
          storedReceiptPath = objectPath;
        }

        const { error: rpcErr } = await supabase.rpc('submit_payment_receipt', {
          p_booking_id: booking.booking_id,
          p_booking_code: booking.booking_code,
          p_platform_bank_id: selectedBank.id,
          p_receipt_url: storedReceiptPath,
        });

        if (rpcErr && !rpcErr.message.includes('Could not find the function')) {
          throw new Error(rpcErr.message);
        }
      }

      onPaymentSubmitted({
        ...booking,
        status: 'payment_uploaded',
        selected_bank_code: selectedBank.short_name,
        receipt_url: storedReceiptPath,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر إرسال وصل التحويل، حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Summary bar */}
      <div className="rounded-xl bg-emerald-50/70 px-4 py-3 border border-emerald-200/70 text-sm space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-slate-700">
            <span className="font-semibold text-slate-900">{booking.car_label}</span>
            <span className="mx-2 text-slate-400">·</span>
            <span>{booking.days} أيام</span>
          </div>
          <div className="font-mono-tabular text-xs font-semibold text-emerald-800">
            مرجع الطلب: {booking.booking_code}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-emerald-200/60">
          <span className="text-emerald-900 font-bold">
            العربون المطلوب تحويله الآن (10%):{' '}
            <span dir="ltr" className="font-mono-tabular">
              {formatDH(booking.commission_amount)}
            </span>
          </span>
          <span className="text-slate-600">
            الباقي عند الاستلام للوكالة (90%):{' '}
            <span dir="ltr" className="font-mono-tabular font-semibold text-slate-800">
              {formatDH(booking.agency_payout_amount)}
            </span>
          </span>
        </div>
      </div>

      {/* Bank Selection Radio Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-[#1B5E20] text-white flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-slate-900 text-base">
            اختر البنك للتحويل <span className="text-amber-600">*</span>
          </h4>
        </div>

        <div
          role="radiogroup"
          aria-label="اختر البنك لتحويل العربون"
          className="grid grid-cols-2 sm:grid-cols-3 gap-2.5"
        >
          {banks.map((bank) => {
            const isSelected = selectedBank.id === bank.id;
            return (
              <button
                key={bank.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelectBank(bank)}
                className={`relative flex items-center gap-2.5 rounded-xl p-3 border text-right transition-all min-h-[64px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                  isSelected
                    ? 'border-[#1B5E20] bg-emerald-50/75 ring-1 ring-[#1B5E20]/25 shadow-xs'
                    : 'border-slate-200 bg-white hover:border-emerald-300'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-[#1B5E20] bg-[#1B5E20] text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </span>

                <BankLogo code={bank.code} className="w-8 h-8 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold tracking-tight text-slate-900 truncate">
                    {bank.short_name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{bank.display_name_ar}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Bank RIB Card */}
      <div className="rounded-2xl border border-emerald-900/15 bg-[#FAFBF8] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
          <span className="text-xs font-medium text-slate-500">الحساب البنكي المحدد</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">
              {selectedBank.display_name_ar} ({selectedBank.short_name})
            </span>
            <BankLogo code={selectedBank.code} className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-200/70 pb-2.5">
          <span className="text-xs font-medium text-slate-500">اسم المستلم</span>
          <span className="text-sm font-bold text-emerald-800">
            {selectedBank.account_holder_name}
          </span>
        </div>

        <div className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-slate-500">رقم الحساب البنكي (RIB)</span>
            <button
              type="button"
              onClick={handleCopyRib}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[38px] ${
                copiedRib
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#1B5E20] hover:bg-[#144718] text-white'
              }`}
            >
              {copiedRib ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRib ? 'تم النسخ (Copied!)' : 'نسخ (Copy)'}</span>
            </button>
          </div>

          <div
            dir="ltr"
            className={`rounded-xl border border-dashed px-3 py-3 text-center font-mono-tabular text-sm sm:text-base font-bold tracking-wider select-all transition-colors ${
              copiedRib
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                : 'border-emerald-700/35 bg-white text-slate-900'
            }`}
          >
            {selectedBank.rib}
          </div>

          {copiedRib && (
            <div
              role="status"
              className="rounded-lg bg-emerald-100/80 border border-emerald-300 px-3 py-1.5 text-xs font-semibold text-emerald-900 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span>Copied! تم نسخ رقم الـ RIB بنجاح إلى الحافظة</span>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Upload Section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-[#1B5E20] text-white flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-slate-900 text-base">
            إرفاق وصل تحويل العربون <span className="text-amber-600">*</span>
          </h4>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`w-full min-h-[120px] rounded-2xl border-2 border-dashed transition-colors p-5 flex flex-col items-center justify-center gap-2 text-center ${
            fileError
              ? 'border-red-400 bg-red-50/40 hover:bg-red-50/60'
              : 'border-emerald-700/25 bg-[#FAFBF8] hover:bg-emerald-50/40 hover:border-emerald-600/50'
          }`}
        >
          {receiptFile ? (
            <div className="flex flex-col items-center gap-2">
              {receiptPreviewUrl ? (
                <img
                  src={receiptPreviewUrl}
                  alt="معاينة وصل التحويل"
                  className="h-24 w-auto rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <span className="text-sm font-bold text-emerald-900 break-all">
                {receiptFile.name}
              </span>
              <span className="text-xs text-emerald-700 font-mono-tabular">
                {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB · انقر لتغيير الملف
              </span>
            </div>
          ) : (
            <>
              <span className="w-11 h-11 rounded-xl bg-emerald-100/80 text-[#1B5E20] flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </span>
              <span className="text-sm font-bold text-slate-900">انقر لاختيار وصل التحويل</span>
              <span className="text-xs text-slate-500">
                الصيغ المسموح بها: JPG, PNG, PDF (الحد الأقصى 5MB)
              </span>
            </>
          )}
        </button>

        {fileError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
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

      {/* Primary Action Button */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirmPayment}
          className="w-full min-h-[48px] rounded-2xl bg-[#1B5E20] hover:bg-[#144718] disabled:opacity-65 disabled:cursor-not-allowed text-white py-3.5 px-5 font-bold text-base shadow-sm transition-colors flex items-center justify-center gap-3"
        >
          {submitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>جاري تأكيد تحويل العربون...</span>
            </>
          ) : (
            <>
              <span>تأكيد الدفع</span>
              <span
                dir="ltr"
                className="rounded-lg bg-[#113D14] border border-amber-400/40 px-2.5 py-0.5 text-xs font-mono-tabular font-bold text-amber-300"
              >
                {formatDH(booking.commission_amount)}
              </span>
            </>
          )}
        </button>

        {onBack && (
          <button
            type="button"
            disabled={submitting}
            onClick={onBack}
            className="w-full min-h-[40px] py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            تعديل بيانات الحجز
          </button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pt-1 text-center">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            تحويل مؤمّن · استرجع عربونك كاملاً عبر التحويل الفوري لرقم هاتفك أو حسابك البنكي خلال
            ساعات من التحقق
          </span>
        </div>
      </div>
    </div>
  );
};
