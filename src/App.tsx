import { useEffect, useRef, useState } from 'react';
import {
  Loader2,
  Lock,
  Home,
  CalendarCheck2,
  UserCircle2,
  HelpCircle,
  ShieldCheck,
  X,
  MessageCircle,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { verifyAdminAccess } from './lib/adminAuth';
import { CustomerPortal } from './components/CustomerPortal';
import { MyBookingsView } from './components/MyBookingsView';
import { AgencyPortal } from './components/AgencyPortal';
import { AdminConsole } from './components/AdminConsole';
import { AdminPinModal } from './components/AdminPinModal';
import {
  FloatingWhatsAppButton,
  CONFIGURED_WHATSAPP,
  DEFAULT_SUPPORT_MESSAGE,
} from './components/FloatingWhatsAppButton';
import type { BookingStatus, CreatedBooking } from './types/karya';

type AppRoute = 'discover' | 'bookings' | 'agency' | 'admin';

const BOOKINGS_STORAGE_KEY = 'karya_recent_bookings_v1';

function loadStoredBookings(): CreatedBooking[] {
  try {
    const raw = window.localStorage.getItem(BOOKINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CreatedBooking[]) : [];
  } catch {
    return [];
  }
}

function saveStoredBookings(bookings: CreatedBooking[]) {
  try {
    window.localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(bookings.slice(0, 30)));
  } catch {
    // Ignore storage quota errors
  }
}

function pathToRoute(pathname: string): AppRoute {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  if (normalized === '/admin-portal') return 'admin';
  if (normalized === '/agency') return 'agency';
  if (normalized === '/my-bookings' || normalized === '/track') return 'bookings';
  return 'discover';
}

function routeToPath(route: AppRoute): string {
  switch (route) {
    case 'admin':
      return '/admin-portal';
    case 'agency':
      return '/agency';
    case 'bookings':
      return '/my-bookings';
    case 'discover':
    default:
      return '/';
  }
}

export function App() {
  const [route, setRoute] = useState<AppRoute>(() => pathToRoute(window.location.pathname));
  const [recentBookings, setRecentBookings] = useState<CreatedBooking[]>(() => loadStoredBookings());
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [showAdminPinModal, setShowAdminPinModal] = useState(false);
  const [showMobileHelpSheet, setShowMobileHelpSheet] = useState(false);
  const copyrightClickTimestamps = useRef<number[]>([]);

  const navigate = (nextRoute: AppRoute, replace = false) => {
    setShowMobileHelpSheet(false);
    const targetPath = routeToPath(nextRoute);
    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState(null, '', targetPath);
      } else {
        window.history.pushState(null, '', targetPath);
      }
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const refreshAdminStatus = async () => {
    const { isAdmin: verified } = await verifyAdminAccess();
    setIsAdmin(verified);
    setAdminChecked(true);
    return verified;
  };

  useEffect(() => {
    refreshAdminStatus();

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshAdminStatus();
    });

    const handlePopState = () => {
      setRoute(pathToRoute(window.location.pathname));
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (route === 'admin' && adminChecked && !isAdmin) {
      navigate('discover', true);
    }
  }, [route, adminChecked, isAdmin]);

  const handleOpenAdminEntry = () => {
    if (isAdmin) {
      navigate('admin');
      return;
    }
    setShowAdminPinModal(true);
  };

  const handleCopyrightClick = () => {
    const now = Date.now();
    const recent = copyrightClickTimestamps.current.filter((ts) => now - ts < 700);
    recent.push(now);
    copyrightClickTimestamps.current = recent;

    if (recent.length >= 3) {
      copyrightClickTimestamps.current = [];
      handleOpenAdminEntry();
    }
  };

  const handleAdminUnlockSuccess = async () => {
    setShowAdminPinModal(false);
    setIsAdmin(true);
    setAdminChecked(true);
    await refreshAdminStatus();
    navigate('admin');
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setAdminChecked(true);
    navigate('discover', true);
  };

  const handleBookingCreated = (booking: CreatedBooking) => {
    setRecentBookings((prev) => {
      const next = [booking, ...prev.filter((b) => b.booking_code !== booking.booking_code)];
      saveStoredBookings(next);
      return next;
    });
  };

  const handleUpdateBookingStatus = (bookingCode: string, nextStatus: BookingStatus) => {
    setRecentBookings((prev) => {
      const next = prev.map((b) =>
        b.booking_code === bookingCode ? { ...b, status: nextStatus } : b,
      );
      saveStoredBookings(next);
      return next;
    });
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[var(--karya-bg)] text-[var(--karya-text)] pb-[64px] md:pb-0"
      dir="rtl"
    >
      {/* Clean 3-Zone Top Bar */}
      <header className="bg-[var(--karya-surface)]/95 backdrop-blur-md border-b border-[var(--karya-border)] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="text-xl font-extrabold tracking-tight text-[var(--karya-primary)] whitespace-nowrap shrink-0 flex items-center gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] rounded-md px-1 -mx-1"
          >
            <span>Karya</span>
            <span className="text-[var(--karya-accent)]">.</span>
          </button>

          {/* Zone 2: Concise single-line desktop navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-[var(--karya-text-muted)]">
            <button
              type="button"
              onClick={() => navigate('discover')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--karya-primary)] py-1 ${
                route === 'discover'
                  ? 'text-[var(--karya-primary)] font-bold underline underline-offset-8 decoration-2 decoration-[var(--karya-action)]'
                  : ''
              }`}
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => navigate('bookings')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--karya-primary)] py-1 ${
                route === 'bookings'
                  ? 'text-[var(--karya-primary)] font-bold underline underline-offset-8 decoration-2 decoration-[var(--karya-action)]'
                  : ''
              }`}
            >
              حجوزاتي
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[var(--karya-primary)] py-1 ${
                  route === 'admin'
                    ? 'text-[var(--karya-primary)] font-bold underline underline-offset-8 decoration-2 decoration-[var(--karya-action)]'
                    : ''
                }`}
              >
                الإدارة
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(route === 'agency' ? 'discover' : 'agency')}
              className="rounded-lg bg-[var(--karya-primary)] hover:bg-[var(--karya-primary-hover)] text-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--karya-action)] focus-visible:ring-offset-2"
            >
              {route === 'agency' ? 'تصفح السيارات' : 'بوابة الوكالات'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {route === 'discover' && (
          <CustomerPortal
            onBookingCreated={handleBookingCreated}
            onGoToAgency={() => navigate('agency')}
          />
        )}

        {route === 'bookings' && (
          <MyBookingsView
            recentBookings={recentBookings}
            onUpdateBookingStatus={handleUpdateBookingStatus}
            onBrowseCars={() => navigate('discover')}
          />
        )}

        {route === 'agency' && <AgencyPortal onGoToCustomer={() => navigate('discover')} />}

        {route === 'admin' && !adminChecked && (
          <div className="min-h-[60vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--karya-action)]" />
          </div>
        )}

        {route === 'admin' && adminChecked && isAdmin && (
          <AdminConsole
            onUnauthorized={() => navigate('discover', true)}
            onLogout={handleAdminLogout}
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-[var(--karya-surface)] border-t border-[var(--karya-border)] py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--karya-text-muted)]">
          <div onClick={handleCopyrightClick} className="select-none cursor-default">
            © Karya — كراء السيارات في المغرب بدون ضمانة مالية
          </div>
          {route === 'discover' && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleOpenAdminEntry}
                aria-label="دخول الإدارة"
                title=""
                className="text-slate-300/70 hover:text-[var(--karya-text-muted)] transition-colors p-1 -me-1"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Clean Mobile Bottom Navigation Bar (Home, My Bookings, Agency, Help) */}
      <nav
        aria-label="التنقل السفلي"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[62px] pb-safe bg-[var(--karya-surface)]/95 backdrop-blur-md border-t border-[var(--karya-border)] shadow-[0_-4px_16px_rgba(23,59,87,0.06)] grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => navigate('discover')}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            route === 'discover' && !showMobileHelpSheet
              ? 'text-[var(--karya-primary)] font-extrabold'
              : 'text-[var(--karya-text-muted)] font-medium'
          }`}
        >
          {route === 'discover' && !showMobileHelpSheet && (
            <span
              className="absolute top-0 inset-x-auto w-8 h-0.5 rounded-b-full bg-[var(--karya-action)]"
              aria-hidden="true"
            />
          )}
          <Home
            className="w-5 h-5"
            strokeWidth={route === 'discover' && !showMobileHelpSheet ? 2.25 : 1.75}
          />
          <span className="text-[11px] whitespace-nowrap">الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('bookings')}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            route === 'bookings' && !showMobileHelpSheet
              ? 'text-[var(--karya-primary)] font-extrabold'
              : 'text-[var(--karya-text-muted)] font-medium'
          }`}
        >
          {route === 'bookings' && !showMobileHelpSheet && (
            <span
              className="absolute top-0 inset-x-auto w-8 h-0.5 rounded-b-full bg-[var(--karya-action)]"
              aria-hidden="true"
            />
          )}
          <CalendarCheck2
            className="w-5 h-5"
            strokeWidth={route === 'bookings' && !showMobileHelpSheet ? 2.25 : 1.75}
          />
          <span className="text-[11px] whitespace-nowrap">حجوزاتي</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('agency')}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            route === 'agency' && !showMobileHelpSheet
              ? 'text-[var(--karya-primary)] font-extrabold'
              : 'text-[var(--karya-text-muted)] font-medium'
          }`}
        >
          {route === 'agency' && !showMobileHelpSheet && (
            <span
              className="absolute top-0 inset-x-auto w-8 h-0.5 rounded-b-full bg-[var(--karya-action)]"
              aria-hidden="true"
            />
          )}
          <UserCircle2
            className="w-5 h-5"
            strokeWidth={route === 'agency' && !showMobileHelpSheet ? 2.25 : 1.75}
          />
          <span className="text-[11px] whitespace-nowrap">حسابي</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMobileHelpSheet((v) => !v)}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            showMobileHelpSheet
              ? 'text-[var(--karya-primary)] font-extrabold'
              : 'text-[var(--karya-text-muted)] font-medium'
          }`}
        >
          {showMobileHelpSheet && (
            <span
              className="absolute top-0 inset-x-auto w-8 h-0.5 rounded-b-full bg-[var(--karya-action)]"
              aria-hidden="true"
            />
          )}
          <HelpCircle
            className="w-5 h-5"
            strokeWidth={showMobileHelpSheet ? 2.25 : 1.75}
          />
          <span className="text-[11px] whitespace-nowrap">مساعدة</span>
        </button>
      </nav>

      {/* Mobile Help Bottom Sheet */}
      {showMobileHelpSheet && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-[#173B57]/55 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setShowMobileHelpSheet(false)}
          dir="rtl"
        >
          <div
            className="w-full rounded-t-2xl bg-[var(--karya-surface)] p-5 pb-8 space-y-4 shadow-xl border-t border-[var(--karya-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-base text-[var(--karya-primary)]">
                <ShieldCheck className="w-5 h-5 text-[var(--karya-action)]" />
                <span>المساعدة وقواعد Karya</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileHelpSheet(false)}
                aria-label="إغلاق"
                className="min-h-[44px] min-w-[44px] rounded-lg flex items-center justify-center text-[var(--karya-text-muted)] hover:bg-[var(--karya-bg)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ul className="space-y-2.5 text-xs text-[var(--karya-text)] leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--karya-action)] shrink-0 mt-0.5" />
                <span>
                  <strong>بدون ضمانة مالية:</strong> لا تحتاج إلى تقديم شيك ضمان أو ترك مبلغ مالي كضمانة، ومدة الكراء لا تقل عن 3 أيام.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--karya-action)] shrink-0 mt-0.5" />
                <span>
                  <strong>رخصة السياقة والعقد:</strong> يجب أن تكون لديك رخصة سياقة منذ 3 سنوات على الأقل مع تقديم البطاقة الوطنية وتوقيع عقد الكراء عند الاستلام.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--karya-action)] shrink-0 mt-0.5" />
                <span>
                  <strong>طريقة الدفع:</strong> تدفع 10% لتأكيد الحجز والمبلغ المتبقي (90%) مباشرة للوكالة عند استلام السيارة.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[var(--karya-action)] shrink-0 mt-0.5" />
                <span>
                  <strong>استرجاع مبلغ الحجز:</strong> إذا لم تتمكن الوكالة من تسليم السيارة، يمكنك طلب استرجاع المبلغ من صفحة «حجوزاتي» وفق الإجراءات المعتمدة.
                </span>
              </li>
            </ul>

            {CONFIGURED_WHATSAPP.length >= 9 && (
              <a
                href={`https://wa.me/${CONFIGURED_WHATSAPP}?text=${DEFAULT_SUPPORT_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] rounded-lg bg-[var(--karya-action)] hover:bg-[var(--karya-action-hover)] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>تواصل عبر واتساب</span>
              </a>
            )}
          </div>
        </div>
      )}

      {showAdminPinModal && (
        <AdminPinModal
          onClose={() => setShowAdminPinModal(false)}
          onSuccess={handleAdminUnlockSuccess}
        />
      )}

      <FloatingWhatsAppButton />
    </div>
  );
}

export default App;
