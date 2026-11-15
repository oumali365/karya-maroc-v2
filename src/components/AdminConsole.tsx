import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Check,
  Shield,
  Wallet,
  Building2,
  Loader2,
  LogOut,
  XCircle,
  Eye,
  Clock,
  X,
  ExternalLink,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logoutAdminAccess, verifyAdminAccess } from '../lib/adminAuth';
import { Badge, PrimaryButton, SecondaryButton } from './ui';
import { useLanguage } from '../i18n';
import type { AgencyBookingRecord, AgencyProfile, PayoutRecord } from '../types/karya';

interface AdminConsoleProps {
  onUnauthorized: () => void;
  onLogout?: () => void;
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ onUnauthorized, onLogout }) => {
  const { dir, lang, formatPrice, getCityLabel } = useLanguage();
  const [tab, setTab] = useState<'receipts' | 'payouts' | 'agencies'>('receipts');
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [bookings, setBookings] = useState<AgencyBookingRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [agencies, setAgencies] = useState<AgencyProfile[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{
    url: string;
    code: string;
    isPdf: boolean;
  } | null>(null);

  const loadAdminData = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { isAdmin, mode } = await verifyAdminAccess();
      if (!isAdmin) {
        setAuthorized(false);
        onUnauthorized();
        return;
      }

      setAuthorized(true);

      const [bRes, pRes, aRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('*, agencies(name), agency_cars(brand, model)')
          .order('created_at', { ascending: false }),
        supabase.from('payouts').select('*').order('created_at', { ascending: false }),
        supabase.from('agencies').select('*').order('created_at', { ascending: false }),
      ]);

      if (bRes.error && mode === 'supabase') throw new Error(bRes.error.message);
      if (pRes.error && mode === 'supabase') throw new Error(pRes.error.message);
      if (aRes.error && mode === 'supabase') throw new Error(aRes.error.message);

      setBookings(
        (bRes.data || []).map((r: Record<string, any>) => ({
          ...r,
          agency_name: r.agencies?.name,
          car_brand: r.agency_cars?.brand,
          car_model: r.agency_cars?.model,
        })) as AgencyBookingRecord[],
      );
      setPayouts((pRes.data || []) as PayoutRecord[]);
      setAgencies((aRes.data || []) as AgencyProfile[]);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'تعذر تحميل بيانات الإدارة من قاعدة البيانات.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleVerifyPayment = async (bookingId: string) => {
    setBusyBookingId(bookingId);
    setErrorMsg(null);
    const { error } = await supabase.rpc('admin_verify_payment', { p_booking_id: bookingId });
    if (error) {
      setErrorMsg(error.message);
    }
    setBusyBookingId(null);
    loadAdminData();
  };

  const handleRejectPayment = async (bookingId: string) => {
    setBusyBookingId(bookingId);
    setErrorMsg(null);
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId);
    if (error) {
      setErrorMsg(error.message);
    }
    setBusyBookingId(null);
    loadAdminData();
  };

  const handleOpenReceipt = async (receiptPath: string, bookingCode: string) => {
    if (!receiptPath || receiptPath.startsWith('local://')) return;
    const isPdf = /\.pdf(\?|$)/i.test(receiptPath);
    if (/^https?:\/\//i.test(receiptPath)) {
      setReceiptPreview({ url: receiptPath, code: bookingCode, isPdf });
      return;
    }
    const { data, error } = await supabase.storage
      .from('payment-receipts')
      .createSignedUrl(receiptPath, 300);
    if (!error && data?.signedUrl) {
      setReceiptPreview({ url: data.signedUrl, code: bookingCode, isPdf });
    } else {
      setErrorMsg(
        lang === 'fr'
          ? 'Impossible d’ouvrir le justificatif. Vérifiez vos droits d’accès administrateur.'
          : 'تعذر فتح وصل التحويل. تأكد من صلاحيات المسؤول على التخزين.',
      );
    }
  };

  const handleMarkPayoutSent = async (payoutId: string) => {
    await supabase
      .from('payouts')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', payoutId);
    loadAdminData();
  };

  const handleVerifyAgency = async (agencyId: string, status: 'verified' | 'suspended') => {
    await supabase.from('agencies').update({ verification_status: status }).eq('id', agencyId);
    loadAdminData();
  };

  const copyText = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text.replace(/\s+/g, ''));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-navy" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  const totalCommission = bookings
    .filter((b) => ['payment_verified', 'car_delivered', 'completed'].includes(b.status))
    .reduce((sum, b) => sum + Number(b.commission_amount || 0), 0);

  const pendingReceiptsCount = bookings.filter((b) => b.status === 'payment_uploaded').length;
  const pendingRefundsCount = payouts.filter((p) => p.status === 'pending').length;
  const pendingAgenciesCount = agencies.filter((a) => a.verification_status === 'pending').length;

  const handleLogout = async () => {
    await logoutAdminAccess();
    if (onLogout) {
      onLogout();
    } else {
      onUnauthorized();
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6" dir={dir}>
      {/* Administrative Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E5E0D5] pb-5">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            {lang === 'fr'
              ? 'Console d’Administration & Trésorerie'
              : 'لوحة إدارة الوساطة والعربون'}
          </h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {lang === 'fr'
              ? 'Contrôle des reçus de virement (10 %), demandes de remboursement et agrément des agences'
              : 'مراجعة وصولات العربون (10%) وتأكيد الحجوزات، ومعالجة طلبات الاسترجاع وتوثيق الوكالات'}
          </p>
        </div>

        <SecondaryButton size="sm" onClick={handleLogout} className="self-start sm:self-auto">
          <LogOut className="w-4 h-4 text-rose-700" />
          <span>{lang === 'fr' ? 'Verrouiller l’accès' : 'قفل الإدارة'}</span>
        </SecondaryButton>
      </div>

      {/* Calm Financial & Operational KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-navy text-white rounded-2xl p-5 border border-navy">
          <p className="text-xs text-[#C7D0DA] font-medium">
            {lang === 'fr' ? 'Revenus confirmés (10 %)' : 'إجمالي الأرباح المؤكدة (10%)'}
          </p>
          <p className="font-latin tabular-nums font-extrabold text-2xl text-gold mt-1.5">
            {formatPrice(totalCommission)}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D5]">
          <p className="text-xs text-ink-muted font-medium">
            {lang === 'fr' ? 'Reçus en attente' : 'الحجوزات قيد المراجعة'}
          </p>
          <p className="font-latin tabular-nums font-extrabold text-2xl text-navy mt-1.5">
            {pendingReceiptsCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D5]">
          <p className="text-xs text-ink-muted font-medium">
            {lang === 'fr' ? 'Remboursements à traiter' : 'طلبات استرجاع معلقة'}
          </p>
          <p className="font-latin tabular-nums font-extrabold text-2xl text-navy mt-1.5">
            {pendingRefundsCount}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-[#E5E0D5]">
          <p className="text-xs text-ink-muted font-medium">
            {lang === 'fr' ? 'Agences à vérifier' : 'وكالات بانتظار التوثيق'}
          </p>
          <p className="font-latin tabular-nums font-extrabold text-2xl text-navy mt-1.5">
            {pendingAgenciesCount}
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
          {errorMsg}
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-1 p-1 bg-white border border-[#E5E0D5] rounded-xl self-start w-full sm:w-fit overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('receipts')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'receipts' ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          <span>
            {lang === 'fr' ? 'Reçus bancaires' : 'مراجعة وصولات العربون'} ({bookings.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('payouts')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'payouts' ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>
            {lang === 'fr' ? 'Remboursements' : 'طلبات استرجاع العربون'} ({payouts.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('agencies')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
            tab === 'agencies' ? 'bg-navy text-white' : 'text-ink-muted hover:text-navy'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>
            {lang === 'fr' ? 'Agences' : 'توثيق الشركات'} ({agencies.length})
          </span>
        </button>
      </div>

      {/* TAB 1: Bank Transfer Receipts Review Table */}
      {tab === 'receipts' && (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] overflow-hidden">
          {bookings.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              {lang === 'fr'
                ? 'Aucun dossier en attente de contrôle.'
                : 'لا توجد طلبات بانتظار المراجعة حالياً.'}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="bg-ivory/75 border-b border-[#E5E0D5] text-xs font-bold text-ink-muted">
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Réservation & Véhicule' : 'الحجز والسيارة'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Banque & Reçu' : 'البنك والوصل'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Montants (Total / 10 %)' : 'المبالغ المالية'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Statut' : 'الحالة'}
                      </th>
                      <th className="py-3.5 px-4 text-end">
                        {lang === 'fr' ? 'Décision' : 'القرار الإداري'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECE3] text-xs sm:text-sm">
                    {bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-ivory/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-mono-tabular font-bold text-navy">{b.booking_code}</div>
                          <div className="text-xs text-ink font-medium mt-0.5">
                            {b.car_brand} {b.car_model} · {b.agency_name}
                          </div>
                          <div className="text-[11px] text-ink-muted mt-0.5">{b.customer_name}</div>
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-bold text-ink font-latin">
                            {b.selected_bank_code || (lang === 'fr' ? 'Non précisé' : 'غير محدد')}
                          </div>
                          {b.receipt_url && !b.receipt_url.startsWith('local://') && (
                            <button
                              type="button"
                              onClick={() => handleOpenReceipt(b.receipt_url!, b.booking_code)}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-navy hover:text-gold-hover underline cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              <span>{lang === 'fr' ? 'Voir le reçu' : 'عرض الوصل'}</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs font-latin tabular-nums">
                          <div className="text-ink-muted">
                            {lang === 'fr' ? 'Total :' : 'الإجمالي:'}{' '}
                            <span className="font-semibold text-ink">
                              {formatPrice(Number(b.total_amount))}
                            </span>
                          </div>
                          <div className="text-navy font-bold mt-0.5">
                            {lang === 'fr' ? 'Acompte 10 % :' : 'العربون 10%:'}{' '}
                            {formatPrice(Number(b.commission_amount))}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              b.status === 'payment_verified' || b.status === 'car_delivered'
                                ? 'success'
                                : b.status === 'cancelled' || b.status === 'refund_requested'
                                  ? 'error'
                                  : 'warning'
                            }
                            icon={
                              b.status === 'payment_verified' || b.status === 'car_delivered' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : b.status === 'cancelled' ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )
                            }
                          >
                            {b.status}
                          </Badge>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {b.status === 'payment_uploaded' && (
                              <>
                                <PrimaryButton
                                  size="sm"
                                  loading={busyBookingId === b.id}
                                  onClick={() => handleVerifyPayment(b.id)}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>{lang === 'fr' ? 'Accepter' : 'قبول الوصل'}</span>
                                </PrimaryButton>
                                <button
                                  type="button"
                                  disabled={busyBookingId === b.id}
                                  onClick={() => handleRejectPayment(b.id)}
                                  className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 px-3 py-2 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>{lang === 'fr' ? 'Refuser' : 'رفض'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards for Receipts */}
              <div className="md:hidden divide-y divide-[#F0ECE3]">
                {bookings.map((b) => (
                  <div key={b.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-mono-tabular font-bold text-navy text-sm">
                          {b.booking_code}
                        </div>
                        <div className="text-xs font-semibold text-ink mt-0.5">
                          {b.car_brand} {b.car_model} · {b.agency_name}
                        </div>
                        <div className="text-[11px] text-ink-muted">{b.customer_name}</div>
                      </div>
                      <Badge
                        variant={
                          b.status === 'payment_verified' || b.status === 'car_delivered'
                            ? 'success'
                            : b.status === 'cancelled' || b.status === 'refund_requested'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {b.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-ivory/75 border border-[#EFECE5] p-2.5 text-xs">
                      <div>
                        <span className="text-ink-muted block">
                          {lang === 'fr' ? 'Acompte (10 %)' : 'العربون (10%)'}
                        </span>
                        <span className="font-latin tabular-nums font-bold text-navy">
                          {formatPrice(Number(b.commission_amount))}
                        </span>
                      </div>
                      <div>
                        <span className="text-ink-muted block">
                          {lang === 'fr' ? 'Banque' : 'البنك'}
                        </span>
                        <span className="font-latin font-bold text-ink">
                          {b.selected_bank_code || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {b.receipt_url && !b.receipt_url.startsWith('local://') && (
                        <SecondaryButton
                          size="sm"
                          onClick={() => handleOpenReceipt(b.receipt_url!, b.booking_code)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{lang === 'fr' ? 'Voir le reçu' : 'عرض الوصل'}</span>
                        </SecondaryButton>
                      )}
                      {b.status === 'payment_uploaded' && (
                        <>
                          <PrimaryButton
                            size="sm"
                            loading={busyBookingId === b.id}
                            onClick={() => handleVerifyPayment(b.id)}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{lang === 'fr' ? 'Accepter' : 'قبول الوصل'}</span>
                          </PrimaryButton>
                          <button
                            type="button"
                            disabled={busyBookingId === b.id}
                            onClick={() => handleRejectPayment(b.id)}
                            className="min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-xs font-bold cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>{lang === 'fr' ? 'Refuser' : 'رفض'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Refund Requests Table */}
      {tab === 'payouts' && (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              {lang === 'fr'
                ? 'Aucune demande de remboursement enregistrée.'
                : 'لا توجد طلبات استرجاع عربون مسجلة حالياً.'}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="bg-ivory/75 border-b border-[#E5E0D5] text-xs font-bold text-ink-muted">
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Bénéficiaire' : 'العميل المستفيد'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Canal / RIB / Téléphone' : 'البنك / الحساب / الهاتف'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Montant' : 'المبلغ'}
                      </th>
                      <th className="py-3.5 px-4 text-end">
                        {lang === 'fr' ? 'Action' : 'الإجراء'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECE3] text-xs sm:text-sm">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-ivory/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-navy">{p.recipient_name}</div>
                          {p.notes && (
                            <div className="text-[11px] text-ink-muted mt-0.5 max-w-xs truncate">
                              {p.notes}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-semibold text-ink">{p.recipient_bank}</div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span dir="ltr" className="font-mono text-navy">
                              {p.recipient_rib}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyText(p.id, p.recipient_rib)}
                              className="inline-flex items-center gap-1 text-navy hover:text-gold-hover font-semibold cursor-pointer"
                            >
                              {copiedId === p.id ? (
                                <Check className="w-3 h-3 text-emerald-700" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span>
                                {copiedId === p.id
                                  ? lang === 'fr'
                                    ? 'Copié'
                                    : 'نُسخ'
                                  : lang === 'fr'
                                    ? 'Copier'
                                    : 'نسخ'}
                              </span>
                            </button>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-latin tabular-nums font-extrabold text-navy">
                          {formatPrice(Number(p.amount))}
                        </td>

                        <td className="py-3.5 px-4 text-end">
                          {p.status === 'pending' ? (
                            <PrimaryButton size="sm" onClick={() => handleMarkPayoutSent(p.id)}>
                              <span>
                                {lang === 'fr' ? 'Confirmer le virement' : 'تأكيد إرسال الاسترجاع'}
                              </span>
                            </PrimaryButton>
                          ) : (
                            <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                              {lang === 'fr' ? 'Transféré' : 'تم التحويل'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards for Payouts */}
              <div className="md:hidden divide-y divide-[#F0ECE3]">
                {payouts.map((p) => (
                  <div key={p.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-navy text-sm">{p.recipient_name}</div>
                        <div className="text-xs text-ink-muted">{p.recipient_bank}</div>
                      </div>
                      <span className="font-latin tabular-nums font-extrabold text-navy text-sm">
                        {formatPrice(Number(p.amount))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-ivory/75 border border-[#EFECE5] px-3 py-2 text-xs">
                      <span dir="ltr" className="font-mono text-navy truncate">
                        {p.recipient_rib}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyText(p.id, p.recipient_rib)}
                        className="inline-flex items-center gap-1 text-navy font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedId === p.id ? (
                          <Check className="w-3 h-3 text-emerald-700" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>
                          {copiedId === p.id
                            ? lang === 'fr'
                              ? 'Copié'
                              : 'نُسخ'
                            : lang === 'fr'
                              ? 'Copier'
                              : 'نسخ'}
                        </span>
                      </button>
                    </div>
                    {p.notes && <p className="text-[11px] text-ink-muted">{p.notes}</p>}
                    <div>
                      {p.status === 'pending' ? (
                        <PrimaryButton
                          size="sm"
                          fullWidth
                          onClick={() => handleMarkPayoutSent(p.id)}
                        >
                          <span>
                            {lang === 'fr' ? 'Confirmer le virement' : 'تأكيد إرسال الاسترجاع'}
                          </span>
                        </PrimaryButton>
                      ) : (
                        <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
                          {lang === 'fr' ? 'Transféré' : 'تم التحويل'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Agencies Verification Table */}
      {tab === 'agencies' && (
        <div className="bg-white rounded-2xl border border-[#E5E0D5] overflow-hidden">
          {agencies.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-muted">
              {lang === 'fr'
                ? 'Aucune agence enregistrée.'
                : 'لا توجد شركات مسجلة للمراجعة حالياً.'}
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-start border-collapse">
                  <thead>
                    <tr className="bg-ivory/75 border-b border-[#E5E0D5] text-xs font-bold text-ink-muted">
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Agence & Ville' : 'الوكالة والمدينة'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Contact & RIB' : 'الهاتف والحساب البنكي'}
                      </th>
                      <th className="py-3.5 px-4 text-start">
                        {lang === 'fr' ? 'Statut' : 'الحالة'}
                      </th>
                      <th className="py-3.5 px-4 text-end">
                        {lang === 'fr' ? 'Action' : 'الإجراء'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0ECE3] text-xs sm:text-sm">
                    {agencies.map((ag) => (
                      <tr key={ag.id} className="hover:bg-ivory/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-navy">{ag.name}</div>
                          <div className="text-xs text-ink-muted">{getCityLabel(ag.city)}</div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-ink-muted">
                          <div>
                            <span dir="ltr" className="font-mono text-ink font-semibold">
                              {ag.phone}
                            </span>{' '}
                            · {ag.bank_name}
                          </div>
                          <div dir="ltr" className="font-mono text-ink-muted mt-0.5">
                            {ag.bank_rib}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge
                            variant={
                              ag.verification_status === 'verified'
                                ? 'success'
                                : ag.verification_status === 'suspended'
                                  ? 'error'
                                  : 'warning'
                            }
                          >
                            {ag.verification_status === 'verified'
                              ? lang === 'fr'
                                ? 'Vérifiée'
                                : 'موثقة'
                              : ag.verification_status === 'suspended'
                                ? lang === 'fr'
                                  ? 'Suspendue'
                                  : 'موقوفة'
                                : lang === 'fr'
                                  ? 'En attente'
                                  : 'بانتظار التوثيق'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          {ag.verification_status !== 'verified' ? (
                            <PrimaryButton
                              size="sm"
                              onClick={() => handleVerifyAgency(ag.id, 'verified')}
                            >
                              <span>{lang === 'fr' ? 'Valider l’agence' : 'توثيق الشركة'}</span>
                            </PrimaryButton>
                          ) : (
                            <SecondaryButton
                              size="sm"
                              onClick={() => handleVerifyAgency(ag.id, 'suspended')}
                            >
                              <span>{lang === 'fr' ? 'Suspendre' : 'إيقاف مؤقت'}</span>
                            </SecondaryButton>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards for Agencies */}
              <div className="md:hidden divide-y divide-[#F0ECE3]">
                {agencies.map((ag) => (
                  <div key={ag.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-navy text-sm">{ag.name}</div>
                        <div className="text-xs text-ink-muted">{getCityLabel(ag.city)}</div>
                      </div>
                      <Badge
                        variant={
                          ag.verification_status === 'verified'
                            ? 'success'
                            : ag.verification_status === 'suspended'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {ag.verification_status === 'verified'
                          ? lang === 'fr'
                            ? 'Vérifiée'
                            : 'موثقة'
                          : ag.verification_status === 'suspended'
                            ? lang === 'fr'
                              ? 'Suspendue'
                              : 'موقوفة'
                            : lang === 'fr'
                              ? 'En attente'
                              : 'بانتظار التوثيق'}
                      </Badge>
                    </div>
                    <div className="rounded-xl bg-ivory/75 border border-[#EFECE5] px-3 py-2 text-xs space-y-0.5">
                      <div dir="ltr" className="font-mono text-ink font-semibold">
                        {ag.phone} · {ag.bank_name}
                      </div>
                      <div dir="ltr" className="font-mono text-ink-muted break-all">
                        {ag.bank_rib}
                      </div>
                    </div>
                    <div>
                      {ag.verification_status !== 'verified' ? (
                        <PrimaryButton
                          size="sm"
                          fullWidth
                          onClick={() => handleVerifyAgency(ag.id, 'verified')}
                        >
                          <span>{lang === 'fr' ? 'Valider l’agence' : 'توثيق الشركة'}</span>
                        </PrimaryButton>
                      ) : (
                        <SecondaryButton
                          size="sm"
                          fullWidth
                          onClick={() => handleVerifyAgency(ag.id, 'suspended')}
                        >
                          <span>{lang === 'fr' ? 'Suspendre' : 'إيقاف مؤقت'}</span>
                        </SecondaryButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* In-app Receipt Preview Modal */}
      {receiptPreview && (
        <div
          className="fixed inset-0 z-50 bg-navy/70 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setReceiptPreview(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-2xl border border-[#E5E0D5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EFECE5] bg-ivory/70">
              <div>
                <h3 className="font-bold text-sm text-navy">
                  {lang === 'fr' ? 'Justificatif de virement' : 'معاينة وصل التحويل البنكي'}
                </h3>
                <p className="text-xs font-mono-tabular text-ink-muted">{receiptPreview.code}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={receiptPreview.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-xl border border-[#E2DDD3] bg-white hover:bg-ivory px-3 py-1.5 text-xs font-semibold text-navy"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{lang === 'fr' ? 'Ouvrir' : 'فتح الملف'}</span>
                </a>
                <button
                  type="button"
                  onClick={() => setReceiptPreview(null)}
                  aria-label={lang === 'fr' ? 'Fermer' : 'إغلاق'}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-muted hover:text-navy hover:bg-ivory-dark cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-ivory/40 flex-1 overflow-auto flex items-center justify-center min-h-[300px]">
              {receiptPreview.isPdf ? (
                <iframe
                  src={receiptPreview.url}
                  title={receiptPreview.code}
                  className="w-full h-[65vh] rounded-xl border border-[#E5E0D5] bg-white"
                />
              ) : (
                <img
                  src={receiptPreview.url}
                  alt={receiptPreview.code}
                  className="max-w-full max-h-[70vh] rounded-xl object-contain border border-[#E5E0D5]"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
