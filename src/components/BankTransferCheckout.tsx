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

const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
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
        // Fallback smoothly to STARTER_BANKS
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
    <div className="space-y-4" dir="rtl">
      <div className="rounded-xl bg-[#F4F6F9] px-4 py-3 border border-slate-200/80 text-sm space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-slate-700 text-xs sm:text-sm">
            <span className="font-extrabold text-[#0F2942]">{booking.car_label}</span>
            <span className="mx-1.5 text-slate-400">·</span>
            <span>{booking.days} أيام</span>
          </div>
          <div className="font-mono-tabular text-xs font-bold text-[#0F2942]">
            {booking.booking_code}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-slate-200/80">
          <span className="text-[#0F2942] font-bold">
            التسبيق الآن (10%):{' '}
            <span dir="ltr" className="font-mono-tabular text-[#0D9488] font-extrabold">
              {formatDH(booking.commission_amount)}
            </span>
          </span>
          <span className="text-slate-600">
            عند الاستلام:{' '}
            <span dir="ltr" className="font-mono-tabular font-bold text-[#0F2942]">
              {formatDH(booking.agency_payout_amount)}
            </span>
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2.5">
          <Landmark className="w-4 h-4 text-[#0F2942]" />
          <h4 className="font-bold text-[#0F2942] text-sm">اختر البنك للتحويل</h4>
        </div>

        <div
          role="radiogroup"
          aria-label="اختر البنك لتحويل التسبيق"
          className="grid grid-cols-2 sm:grid-cols-3 gap-2"
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
                className={`relative flex items-center gap-2 rounded-xl p-2.5 border text-right transition-all min-h-[58px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] ${
                  isSelected
                    ? 'border-[#0D9488] bg-teal-50/70 ring-1 ring-[#0D9488]/25'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-[#0D9488] bg-[#0D9488] text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </span>

                <BankLogo code={bank.code} className="w-7 h-7 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold tracking-tight text-[#0F2942] truncate">
                    {bank.short_name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">{bank.display_name_ar}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-[#F4F6F9] p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">المستفيد</span>
          <span className="font-bold text-[#0F2942]">{selectedBank.account_holder_name}</span>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-slate-500">رقم RIB</span>
          <button
            type="button"
            onClick={handleCopyRib}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
              copiedRib
                ? 'bg-[#0D9488] text-white'
                : 'bg-[#0F2942] hover:bg-[#173B5E] text-white'
            }`}
          >
            {copiedRib ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedRib ? 'تم النسخ' : 'نسخ RIB'}</span>
          </button>
        </div>

        <div
          dir="ltr"
          className={`rounded-xl border px-3 py-2.5 text-center font-mono-tabular text-sm font-bold tracking-wider select-all transition-colors ${
            copiedRib
              ? 'border-[#0D9488] bg-teal-50 text-[#0F2942]'
              : 'border-slate-200 bg-white text-[#0F2942]'
          }`}
        >
          {selectedBank.rib}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-[#0F2942]" />
          <h4 className="font-bold text-[#0F2942] text-sm">إرفاق وصل التحويل</h4>
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
          className={`w-full min-h-[104px] rounded-xl border-2 border-dashed transition-colors p-4 flex flex-col items-center justify-center gap-1.5 text-center ${
            fileError
              ? 'border-red-400 bg-red-50/40'
              : 'border-slate-300 bg-[#F4F6F9] hover:bg-teal-50/30 hover:border-[#0D9488]/60'
          }`}
        >
          {receiptFile ? (
            <div className="flex flex-col items-center gap-1.5">
              {receiptPreviewUrl ? (
                <img
                  src={receiptPreviewUrl}
                  alt="معاينة وصل التحويل"
                  className="h-20 w-auto rounded-lg object-cover border border-slate-200"
                />
              ) : (
                <FileText className="w-7 h-7 text-[#0F2942]" />
              )}
              <span className="text-xs font-bold text-[#0F2942] break-all">
                {receiptFile.name}
              </span>
              <span className="text-[11px] text-slate-500 font-mono-tabular">
                {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB · انقر للتغيير
              </span>
            </div>
          ) : (
            <>
              <Upload className="w-5 h-5 text-[#0D9488]" />
              <span className="text-xs sm:text-sm font-bold text-[#0F2942]">
                اختر صورة أو ملف PDF للوصل
              </span>
              <span className="text-[11px] text-slate-500">JPG, PNG, PDF — حتى 5MB</span>
            </>
          )}
        </button>

        {fileError && (
          <div
            role="alert"
            className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs font-medium text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="space-y-2 pt-1">
        <button
          type="button"
          disabled={submitting}
          onClick={handleConfirmPayment}
          className="w-full min-h-[48px] rounded-xl bg-[#0D9488] hover:bg-[#0F766E] disabled:opacity-65 disabled:cursor-not-allowed text-white py-3 px-5 font-extrabold text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-teal-600/20"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري الإرسال...</span>
            </>
          ) : (
            <>
              <span>تأكيد وإرسال الوصل</span>
              <span dir="ltr" className="font-mono-tabular text-teal-100">
                ({formatDH(booking.commission_amount)})
              </span>
            </>
          )}
        </button>

        {onBack && (
          <button
            type="button"
            disabled={submitting}
            onClick={onBack}
            className="w-full min-h-[38px] py-1.5 text-xs font-semibold text-slate-500 hover:text-[#0F2942] transition-colors"
          >
            العودة لتعديل البيانات
          </button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
          <span>ضمان استرجاع 100% عند تعذر تسليم السيارة</span>
        </div>
      </div>
    </div>
  );
};
