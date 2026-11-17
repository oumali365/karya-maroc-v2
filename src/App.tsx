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
    <div className="min-h-screen flex flex-col bg-[#F4F6F9] text-[#0F2942] pb-[60px] md:pb-0" dir="rtl">
      {/* Clean 3-Zone Top Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="text-xl font-extrabold tracking-tight text-[#0F2942] whitespace-nowrap shrink-0 flex items-center gap-0.5"
          >
            <span>Karya</span>
            <span className="text-[#0D9488]">.</span>
          </button>

          {/* Zone 2: Concise single-line desktop navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => navigate('discover')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#0F2942] ${
                route === 'discover'
                  ? 'text-[#0F2942] font-bold underline underline-offset-8 decoration-2 decoration-[#0D9488]'
                  : ''
              }`}
            >
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => navigate('bookings')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#0F2942] ${
                route === 'bookings'
                  ? 'text-[#0F2942] font-bold underline underline-offset-8 decoration-2 decoration-[#0D9488]'
                  : ''
              }`}
            >
              حجوزاتي
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#0F2942] ${
                  route === 'admin'
                    ? 'text-[#0F2942] font-bold underline underline-offset-8 decoration-2 decoration-[#0D9488]'
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
              className="rounded-xl bg-[#0F2942] hover:bg-[#173B5E] text-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
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
            <Loader2 className="w-8 h-8 animate-spin text-[#0D9488]" />
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
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div onClick={handleCopyrightClick} className="select-none cursor-default">
            © Karya — منصة كراء السيارات بالمغرب بدون ضمان
          </div>
          {route === 'discover' && (
            <div className="flex items-center">
              <button
                type="button"
                onClick={handleOpenAdminEntry}
                aria-label="دخول الإدارة"
                title=""
                className="text-slate-300/60 hover:text-slate-400 transition-colors p-1 -me-1"
              >
                <Lock className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </footer>

      {/* Clean Mobile Bottom Navigation Bar (Home, My Bookings, Profile, Help) */}
      <nav
        aria-label="التنقل السفلي"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 h-[60px] pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(15,41,66,0.06)] grid grid-cols-4 items-center"
      >
        <button
          type="button"
          onClick={() => navigate('discover')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            route === 'discover' && !showMobileHelpSheet
              ? 'text-[#0D9488] font-bold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <Home className="w-5 h-5" strokeWidth={route === 'discover' ? 2.25 : 1.75} />
          <span className="text-[11px] whitespace-nowrap">الرئيسية</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('bookings')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            route === 'bookings' && !showMobileHelpSheet
              ? 'text-[#0D9488] font-bold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <CalendarCheck2 className="w-5 h-5" strokeWidth={route === 'bookings' ? 2.25 : 1.75} />
          <span className="text-[11px] whitespace-nowrap">حجوزاتي</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('agency')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            route === 'agency' && !showMobileHelpSheet
              ? 'text-[#0D9488] font-bold'
              : 'text-slate-500 font-medium'
          }`}
        >
          <UserCircle2 className="w-5 h-5" strokeWidth={route === 'agency' ? 2.25 : 1.75} />
          <span className="text-[11px] whitespace-nowrap">حسابي</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMobileHelpSheet((v) => !v)}
          className={`h-full flex flex-col items-center justify-center gap-0.5 transition-colors ${
            showMobileHelpSheet ? 'text-[#0D9488] font-bold' : 'text-slate-500 font-medium'
          }`}
        >
          <HelpCircle className="w-5 h-5" strokeWidth={showMobileHelpSheet ? 2.25 : 1.75} />
          <span className="text-[11px] whitespace-nowrap">مساعدة</span>
        </button>
      </nav>

      {/* Mobile Help Bottom Sheet */}
      {showMobileHelpSheet && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-[#0F2942]/50 backdrop-blur-xs flex items-end justify-center"
          onClick={() => setShowMobileHelpSheet(false)}
          dir="rtl"
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 pb-8 space-y-4 shadow-2xl border-t border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-extrabold text-base text-[#0F2942]">
                <ShieldCheck className="w-5 h-5 text-[#0D9488]" />
                <span>المساعدة وقواعد Karya</span>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileHelpSheet(false)}
                aria-label="إغلاق"
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <span>
                  <strong>0 درهم ضمان:</strong> كراء بدون شيك ضمان أو كفالة وبحد أدنى 3 أيام.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <span>
                  <strong>رخصة السياقة:</strong> يشترط توفر أقدمية سنتين على الأقل عند التسليم.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <span>
                  <strong>دفع مرن:</strong> 10% تسبيق لتثبيت الحجز و90% مباشرة عند استلام السيارة.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#0D9488] shrink-0 mt-0.5" />
                <span>
                  <strong>حماية التسبيق 100%:</strong> استرجاع فوري من صفحة «حجوزاتي» إذا اعتذرت الوكالة.
                </span>
              </li>
            </ul>

            {CONFIGURED_WHATSAPP.length >= 9 && (
              <a
                href={`https://wa.me/${CONFIGURED_WHATSAPP}?text=${DEFAULT_SUPPORT_MESSAGE}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[46px] rounded-xl bg-[#0D9488] hover:bg-[#0F766E] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors"
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
