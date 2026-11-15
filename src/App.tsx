import { useEffect, useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { supabase } from './lib/supabase';
import { verifyAdminAccess } from './lib/adminAuth';
import { CustomerPortal } from './components/CustomerPortal';
import { MyBookingsView } from './components/MyBookingsView';
import { AgencyPortal } from './components/AgencyPortal';
import { AdminConsole } from './components/AdminConsole';
import { AdminPinModal } from './components/AdminPinModal';
import { FloatingWhatsAppButton } from './components/FloatingWhatsAppButton';
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
  const copyrightClickTimestamps = useRef<number[]>([]);

  const navigate = (nextRoute: AppRoute, replace = false) => {
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

  // Protect /admin-portal: redirect unauthorized users automatically to "/"
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
    <div className="min-h-screen flex flex-col bg-[#F6F8F6] text-slate-900" dir="rtl">
      {/* Clean 3-Zone Top Bar Contract */}
      <header className="bg-white/95 backdrop-blur-xs border-b border-slate-100 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate('discover')}
            className="text-xl font-extrabold tracking-tight text-[#1B5E20] whitespace-nowrap shrink-0"
          >
            Karya
          </button>

          {/* Zone 2: Clean single-line navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => navigate('discover')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1B5E20] ${
                route === 'discover' ? 'text-[#1B5E20] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              اكتشف العروض
            </button>
            <button
              type="button"
              onClick={() => navigate('bookings')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1B5E20] ${
                route === 'bookings' ? 'text-[#1B5E20] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              حجوزاتي
            </button>
            <button
              type="button"
              onClick={() => navigate('agency')}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1B5E20] ${
                route === 'agency' ? 'text-[#1B5E20] underline underline-offset-8 decoration-2' : ''
              }`}
            >
              بوابة الوكالات
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={() => navigate('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-[#1B5E20] ${
                  route === 'admin' ? 'text-[#1B5E20] underline underline-offset-8 decoration-2' : ''
                }`}
              >
                إدارة الوساطة
              </button>
            )}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigate(route === 'agency' ? 'discover' : 'agency')}
              className="rounded-xl bg-[#1B5E20] hover:bg-[#144718] text-white px-4 py-2 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap shrink-0"
            >
              {route === 'agency' ? 'تصفح السيارات' : 'بوابة الوكالات'}
            </button>
          </div>
        </div>

        {/* Mobile navigation strip */}
        <div className="md:hidden border-t border-slate-100 px-4 py-2 flex items-center gap-5 overflow-x-auto text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => navigate('discover')}
            className={`whitespace-nowrap shrink-0 ${route === 'discover' ? 'text-[#1B5E20]' : ''}`}
          >
            اكتشف العروض
          </button>
          <button
            type="button"
            onClick={() => navigate('bookings')}
            className={`whitespace-nowrap shrink-0 ${route === 'bookings' ? 'text-[#1B5E20]' : ''}`}
          >
            حجوزاتي
          </button>
          <button
            type="button"
            onClick={() => navigate('agency')}
            className={`whitespace-nowrap shrink-0 ${route === 'agency' ? 'text-[#1B5E20]' : ''}`}
          >
            بوابة الوكالات
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => navigate('admin')}
              className={`whitespace-nowrap shrink-0 ${route === 'admin' ? 'text-[#1B5E20]' : ''}`}
            >
              إدارة الوساطة
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1">
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
            <Loader2 className="w-8 h-8 animate-spin text-emerald-700" />
          </div>
        )}

        {route === 'admin' && adminChecked && isAdmin && (
          <AdminConsole
            onUnauthorized={() => navigate('discover', true)}
            onLogout={handleAdminLogout}
          />
        )}
      </div>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-100 py-7 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div
            onClick={handleCopyrightClick}
            className="select-none cursor-default"
          >
            © Karya — منصة كراء السيارات في المغرب
          </div>
          <div className="flex items-center gap-5">
            <button type="button" onClick={() => navigate('discover')} className="hover:text-slate-900">
              السيارات المتاحة
            </button>
            <button type="button" onClick={() => navigate('bookings')} className="hover:text-slate-900">
              حجوزاتي
            </button>
            <button type="button" onClick={() => navigate('agency')} className="hover:text-slate-900">
              انضم كوكالة
            </button>
            {route === 'discover' && (
              <button
                type="button"
                onClick={handleOpenAdminEntry}
                aria-label="دخول الإدارة"
                title=""
                className="text-slate-300/60 hover:text-slate-400 transition-colors p-1 -me-1"
              >
                <Lock className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </footer>

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
