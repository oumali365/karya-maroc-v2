import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Landmark,
  ShieldCheck,
  Upload,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { STARTER_BANKS } from '../data/starterData';
import { BankLogo } from './BankLogo';
import { Badge, PrimaryButton } from './ui';
import { useLanguage } from '../i18n';
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
  const { lang, dir, t, formatPrice } = useLanguage();

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
      setFileError(t('checkout.unsupportedFormat'));
      return;
    }

    if (file.type && !ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      event.target.value = '';
      setFileError(t('checkout.unsupportedFormat'));
      return;
    }

    if (file.size > MAX_RECEIPT_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl);
      setReceiptFile(null);
      setReceiptPreviewUrl(null);
      event.target.value = '';
      setFileError(t('checkout.fileTooLarge', { size: sizeMb }));
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
      setFileError(t('checkout.missingFile'));
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
      setErrorMsg(err instanceof Error ? err.message : t('checkout.submitError'));
    } finally {
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* 10% Deposit Protection Highlight + Summary */}
      <div className="rounded-2xl bg-navy text-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge
            variant="warning"
            icon={<ShieldCheck className="w-3.5 h-3.5 text-gold" />}
            className="bg-white/10 text-gold border-gold/40"
          >
            {t('checkout.protectionBadge')}
          </Badge>
          <span className="font-mono-tabular text-xs font-semibold text-[#D6DCE3]">
            {t('checkout.refPrefix')} {booking.booking_code}
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="font-bold text-sm text-white">{t('checkout.protectionBannerTitle')}</h4>
          <p className="text-xs text-[#C7D0DA] leading-relaxed">
            {t('checkout.protectionBannerDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center justify-between sm:block">
            <span className="text-[#C7D0DA] block">{t('checkout.depositRequired')}</span>
            <span className="font-latin tabular-nums text-base font-extrabold text-gold">
              {formatPrice(booking.commission_amount)}
            </span>
          </div>
          <div className="flex items-center justify-between sm:block sm:text-end">
            <span className="text-[#C7D0DA] block">{t('checkout.remainingAtPickup')}</span>
            <span className="font-latin tabular-nums text-sm font-bold text-white">
              {formatPrice(booking.agency_payout_amount)}
            </span>
          </div>
        </div>
      </div>

      {/* 6 Moroccan Bank Account Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-navy text-gold flex items-center justify-center shrink-0">
            <Landmark className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-ink text-sm sm:text-base">
            {t('checkout.selectBankTitle')} <span className="text-gold">*</span>
          </h4>
        </div>

        <div
          role="radiogroup"
          aria-label={t('checkout.selectBankTitle')}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
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
                className={`relative flex items-center gap-2.5 rounded-xl p-3 border text-start transition-all duration-150 min-h-[68px] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                  isSelected
                    ? 'border-gold bg-gold-soft/75 ring-1 ring-gold/40 shadow-xs'
                    : 'border-[#E5E0D5] bg-white hover:border-navy/35'
                }`}
              >
                <BankLogo code={bank.code} className="w-9 h-9 shrink-0" />

                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold tracking-tight text-navy font-latin truncate">
                    {bank.short_name}
                  </div>
                  <div className="text-[11px] text-ink-muted truncate">
                    {lang === 'ar' ? bank.display_name_ar : bank.short_name}
                  </div>
                </div>

                <span
                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    isSelected
                      ? 'border-navy bg-navy text-gold'
                      : 'border-[#D5CFC2] bg-white'
                  }`}
                  aria-hidden="true"
                >
                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Bank RIB Card */}
      <div className="rounded-2xl border border-[#E5E0D5] bg-ivory/70 p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-2.5">
          <span className="text-xs font-medium text-ink-muted">
            {t('checkout.selectedBankLabel')}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink">
              {lang === 'ar'
                ? `${selectedBank.display_name_ar} (${selectedBank.short_name})`
                : selectedBank.short_name}
            </span>
            <BankLogo code={selectedBank.code} className="w-6 h-6" />
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-[#E5E0D5] pb-2.5">
          <span className="text-xs font-medium text-ink-muted">
            {t('checkout.recipientLabel')}
          </span>
          <span className="text-sm font-bold text-navy font-latin">
            {selectedBank.account_holder_name}
          </span>
        </div>

        <div className="space-y-2 pt-0.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ink-muted">{t('checkout.ribLabel')}</span>
            <button
              type="button"
              onClick={handleCopyRib}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition-colors whitespace-nowrap shrink-0 min-h-[36px] cursor-pointer ${
                copiedRib
                  ? 'bg-emerald-700 text-white'
                  : 'bg-navy hover:bg-navy-light text-white'
              }`}
            >
              {copiedRib ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedRib ? t('checkout.copiedRib') : t('checkout.copyRib')}</span>
            </button>
          </div>

          <div
            dir="ltr"
            className={`rounded-xl border border-dashed px-3 py-3 text-center font-mono-tabular text-sm sm:text-base font-bold tracking-wider select-all transition-colors ${
              copiedRib
                ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                : 'border-gold/60 bg-white text-navy'
            }`}
          >
            {selectedBank.rib}
          </div>

          {copiedRib && (
            <div
              role="status"
              className="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-900 flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span>{t('checkout.copiedBanner')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Upload Section */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-navy text-gold flex items-center justify-center shrink-0">
            <Upload className="w-4 h-4" />
          </span>
          <h4 className="font-bold text-ink text-sm sm:text-base">
            {t('checkout.uploadTitle')} <span className="text-gold">*</span>
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
          className={`w-full min-h-[120px] rounded-2xl border-2 border-dashed transition-colors p-5 flex flex-col items-center justify-center gap-2 text-center cursor-pointer ${
            fileError
              ? 'border-rose-400 bg-rose-50/40 hover:bg-rose-50/60'
              : 'border-gold/45 bg-ivory/60 hover:bg-gold-soft/45 hover:border-gold'
          }`}
        >
          {receiptFile ? (
            <div className="flex flex-col items-center gap-2">
              {receiptPreviewUrl ? (
                <img
                  src={receiptPreviewUrl}
                  alt={t('checkout.uploadTitle')}
                  className="h-24 w-auto rounded-lg object-cover border border-[#E5E0D5]"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gold-soft text-navy flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
              )}
              <span className="text-sm font-bold text-navy break-all">{receiptFile.name}</span>
              <span className="text-xs text-ink-muted font-mono-tabular">
                {(receiptFile.size / (1024 * 1024)).toFixed(2)} MB · {t('checkout.changeFile')}
              </span>
            </div>
          ) : (
            <>
              <span className="w-11 h-11 rounded-xl bg-white border border-[#E5E0D5] text-navy flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </span>
              <span className="text-sm font-bold text-ink">{t('checkout.uploadClick')}</span>
              <span className="text-xs text-ink-muted">{t('checkout.uploadFormats')}</span>
            </>
          )}
        </button>

        {fileError && (
          <div
            role="alert"
            className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-rose-800 flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{fileError}</span>
          </div>
        )}
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

      {/* Primary Action Button */}
      <div className="space-y-2.5 pt-1">
        <PrimaryButton
          fullWidth
          size="lg"
          loading={submitting}
          onClick={handleConfirmPayment}
        >
          {submitting ? (
            <span>{t('checkout.submittingPayment')}</span>
          ) : (
            <>
              <span>{t('checkout.confirmPayment')}</span>
              <span className="font-latin tabular-nums font-extrabold">
                ({formatPrice(booking.commission_amount)})
              </span>
            </>
          )}
        </PrimaryButton>

        {onBack && (
          <button
            type="button"
            disabled={submitting}
            onClick={onBack}
            className="w-full min-h-[40px] py-2 text-xs font-semibold text-ink-muted hover:text-navy transition-colors cursor-pointer"
          >
            {t('checkout.editBooking')}
          </button>
        )}

        <div className="flex items-center justify-center gap-1.5 text-xs text-ink-muted pt-1 text-center">
          <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
          <span>{t('checkout.shieldFooter')}</span>
        </div>
      </div>
    </div>
  );
};
