import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  Landmark,
  ShieldCheck,
  Upload,
  FileText,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDH } from '../lib/supabase';
import { BankLogo } from './BankLogo';
import type { PlatformBank } from '../types/karya';

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_RECEIPT_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);
export const ALLOWED_RECEIPT_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'pdf']);

interface BankTransferCheckoutProps {
  dailyPrice: number;
  days: number;
  totalAmount: number;
  commissionAmount: number;
  agencyPayoutAmount: number;
  banks: PlatformBank[];
  selectedBank: PlatformBank;
  onSelectBank: (bank: PlatformBank) => void;
  receiptFile: File | null;
  receiptPreviewUrl: string | null;
  fileError: string | null;
  onReceiptSelected: (file: File | null, previewUrl: string | null) => void;
  onFileError: (msg: string | null) => void;
}

export const BankTransferCheckout: React.FC<BankTransferCheckoutProps> = ({
  dailyPrice,
  days,
  totalAmount,
  commissionAmount,
  agencyPayoutAmount,
  banks,
  selectedBank,
  onSelectBank,
  receiptFile,
  receiptPreviewUrl,
  fileError,
  onReceiptSelected,
  onFileError,
}) => {
  const [copiedRib, setCopiedRib] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectBank = (bank: PlatformBank) => {
    onSelectBank(bank);
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
    onFileError(null);

    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    const hasValidMime = file.type
      ? ALLOWED_RECEIPT_MIME_TYPES.has(file.type.toLowerCase())
      : false;
    const hasValidExt = ALLOWED_RECEIPT_EXTENSIONS.has(ext);

    if (!hasValidMime && !hasValidExt) {
      onReceiptSelected(null, null);
      event.target.value = '';
      onFileError(
        'صيغة الملف غير مدعومة. يرجى اختيار صورة JPG أو PNG أو ملف PDF فقط.',
      );
      return;
    }

    if (file.type && !ALLOWED_RECEIPT_MIME_TYPES.has(file.type.toLowerCase())) {
      onReceiptSelected(null, null);
      event.target.value = '';
      onFileError(
        'صيغة الملف غير مدعومة. يرجى اختيار صورة JPG أو PNG أو ملف PDF فقط.',
      );
      return;
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      onReceiptSelected(null, null);
      event.target.value = '';
      onFileError(
        `حجم الملف (${sizeMb} MB) يتجاوز الحد الأقصى المسموح به وهو 5MB.`,
      );
      return;
    }

    const isImg =
      file.type.startsWith('image/') ||
      ext === 'jpg' ||
      ext === 'jpeg' ||
      ext === 'png';
    const nextPreview = isImg ? URL.createObjectURL(file) : null;
    onReceiptSelected(file, nextPreview);
  };

  return (
    <div className="space-y-5" dir="rtl">
      {/* Dynamic 5-line Financial Summary */}
      <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-bg)] p-4 space-y-2 text-xs sm:text-sm">
        <div className="flex items-center justify-between text-[var(--karya-text-muted)]">
          <span>السعر اليومي</span>
          <span className="font-mono-tabular font-bold text-[var(--karya-text)]">
            {formatDH(dailyPrice)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[var(--karya-text-muted)]">
          <span>مدة الكراء</span>
          <span className="font-mono-tabular font-bold text-[var(--karya-text)]">
            {days} {days <= 10 ? 'أيام' : 'يوماً'}
          </span>
        </div>
        <div className="flex items-center justify-between text-[var(--karya-text-muted)] pb-2 border-b border-[var(--karya-border)]">
          <span>الإجمالي الكلي</span>
          <span className="font-mono-tabular font-bold text-[var(--karya-text)]">
            {formatDH(totalAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between pt-0.5">
          <span className="font-extrabold text-[var(--karya-primary)]">
            مبلغ تأكيد الحجز (10%)
          </span>
          <span className="font-mono-tabular text-base sm:text-lg font-extrabold text-[var(--karya-action)]">
            {formatDH(commissionAmount)}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--karya-text-muted)]">
          <span>المبلغ المتبقي عند استلام السيارة (90%)</span>
          <span className="font-mono-tabular font-bold text-[var(--karya-primary)]">
            {formatDH(agencyPayoutAmount)}
          </span>
        </div>
      </div>

      {/* Bank Selection */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Landmark className="w-4 h-4 text-[var(--karya-primary)] shrink-0" />
          <h4 className="font-extrabold text-[var(--karya-primary)] text-sm">
            اختر الحساب البنكي للتحويل
          </h4>
        </div>

        <div
          role="radiogroup"
          aria-label="اختر البنك لتحويل مبلغ تأكيد الحجز"
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
                className={`relative flex items-center gap-2 rounded-lg p-2.5 border text-right transition-all min-h-[56px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] ${
                  isSelected
                    ? 'border-[var(--karya-action)] bg-[var(--karya-action-soft)] ring-1 ring-[var(--karya-action)]/25'
                    : 'border-[var(--karya-border)] bg-white hover:border-[var(--karya-action)]/45'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-[var(--karya-action)] bg-[var(--karya-action)] text-white'
                      : 'border-slate-300 bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </span>

                <BankLogo code={bank.code} className="w-7 h-7 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold tracking-tight text-[var(--karya-primary)] truncate">
                    {bank.short_name}
                  </div>
                  <div className="text-[11px] text-[var(--karya-text-muted)] truncate">
                    {bank.display_name_ar}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Bank RIB Card */}
        <div className="rounded-xl border border-[var(--karya-border)] bg-[var(--karya-bg)] p-3.5 sm:p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-[var(--karya-text-muted)]">اسم المستفيد</span>
            <span className="font-bold text-[var(--karya-primary)]">
              {selectedBank.account_holder_name}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-0.5">
            <span className="text-xs text-[var(--karya-text-muted)]">رقم RIB</span>
            <button
              type="button"
              onClick={handleCopyRib}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                copiedRib
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white'
              }`}
            >
              {copiedRib ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRib ? 'تم النسخ' : 'نسخ RIB'}</span>
            </button>
          </div>

          <div
            dir="ltr"
            className={`rounded-lg border px-3 py-2.5 text-center font-mono-tabular text-xs sm:text-sm font-bold tracking-wider select-all transition-colors ${
              copiedRib
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-[var(--karya-border)] bg-white text-[var(--karya-primary)]'
            }`}
          >
            {selectedBank.rib}
          </div>

          {copiedRib && (
            <p className="text-[11px] font-bold text-emerald-700 text-center">
              تم نسخ رقم الحساب البنكي RIB بنجاح
            </p>
          )}
        </div>
      </div>

      {/* Receipt Upload */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[var(--karya-primary)] shrink-0" />
            <h4 className="font-extrabold text-[var(--karya-primary)] text-sm">
              إرفاق وصل التحويل
            </h4>
          </div>
          {receiptFile && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-bold text-[var(--karya-action)] hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>استبدال الملف</span>
            </button>
          )}
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
          className={`w-full min-h-[108px] rounded-xl border-2 border-dashed transition-colors p-4 flex flex-col items-center justify-center gap-1.5 text-center ${
            fileError
              ? 'border-red-400 bg-red-50/40'
              : receiptFile
                ? 'border-emerald-400 bg-emerald-50/40 hover:bg-emerald-50/70'
                : 'border-slate-300 bg-[var(--karya-bg)] hover:bg-[var(--karya-action-soft)] hover:border-[var(--karya-action)]'
          }`}
        >
          {receiptFile ? (
            <div className="flex flex-col items-center gap-1.5">
              {receiptPreviewUrl ? (
                <img
                  src={receiptPreviewUrl}
                  alt="معاينة وصل التحويل"
                  className="h-20 w-auto rounded-lg object-cover border border-[var(--karya-border)] bg-white"
                />
              ) : (
                <FileText className="w-7 h-7 text-[var(--karya-primary)]" />
              )}
              <span className="text-xs font-extrabold text-[var(--karya-primary)] break-all">
                {receiptFile.name}
              </span>
              <span className="text-[11px] text-emerald-700 font-bold font-mono-tabular">
                {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB · جاهز للإرفاق (انقر للاستبدال)
              </span>
            </div>
          ) : (
            <>
              <Upload className="w-5 h-5 text-[var(--karya-action)]" />
              <span className="text-xs sm:text-sm font-bold text-[var(--karya-primary)]">
                اختر صورة أو ملف PDF للوصل
              </span>
              <span className="text-[11px] text-[var(--karya-text-muted)]">
                JPG أو PNG أو PDF — الحد الأقصى 5MB
              </span>
            </>
          )}
        </button>

        {fileError && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[11px] text-[var(--karya-text-muted)] text-center pt-1">
        <ShieldCheck className="w-3.5 h-3.5 text-[var(--karya-action)] shrink-0" />
        <span>استرجاع مبلغ تأكيد الحجز متاح إذا تعذّر تسليم السيارة</span>
      </div>
    </div>
  );
};
