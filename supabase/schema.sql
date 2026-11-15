-- ============================================================================
-- Karya Morocco - Compatible Supabase PostgreSQL Schema
-- Supports:
--   1. Moroccan Cities & GPS Proximity Search (Haversine)
--   2. Rental Agencies (Profile, Phone, Bank RIB, Verification)
--   3. Agency Fleet (Real Car Photos in Storage, Instant Available/Unavailable)
--   4. Multi-Bank Platform Checkout (AL BARID, CHAABI, CIH, TIJJARI, BMCE, CASHPLUS)
--   5. Booking + Payment Receipt Upload + 10% Commission + 90% Agency Payout / 100% Refund
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CITIES (المدن المغربية وإحداثياتها للبحث بالـ GPS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cities (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name_ar TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.cities (slug, name_ar, name_fr, latitude, longitude) VALUES
    ('casablanca', 'الدار البيضاء', 'Casablanca', 33.5731, -7.5898),
    ('rabat', 'الرباط', 'Rabat', 34.0209, -6.8416),
    ('marrakech', 'مراكش', 'Marrakech', 31.6295, -7.9811),
    ('agadir', 'أكادير', 'Agadir', 30.4278, -9.5981),
    ('tangier', 'طنجة', 'Tangier', 35.7595, -5.8340),
    ('fes', 'فاس', 'Fès', 34.0181, -5.0078),
    ('meknes', 'مكناس', 'Meknès', 33.8935, -5.5473),
    ('oujda', 'وجدة', 'Oujda', 34.6814, -1.9086),
    ('kenitra', 'القنيطرة', 'Kénitra', 34.2610, -6.5802),
    ('tetouan', 'تطوان', 'Tétouan', 35.5889, -5.3626),
    ('essaouira', 'الصويرة', 'Essaouira', 31.5085, -9.7595),
    ('nador', 'الناظور', 'Nador', 35.1681, -2.9335)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. PLATFORM ADMINS (مسؤولو المنصة لمراجعة الوصولات وتحويل الأموال)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_admins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    pin_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins
    ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;

ALTER TABLE public.platform_admins
    ADD COLUMN IF NOT EXISTS pin_hash TEXT;

-- دالة آمنة للتحقق من الرمز السري للإدارة عبر التجزئة المشفرة (bcrypt) دون كشف جدول platform_admins
CREATE OR REPLACE FUNCTION public.verify_admin_pin(p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_clean_pin TEXT := NULLIF(TRIM(COALESCE(p_pin, '')), '');
BEGIN
    IF v_clean_pin IS NULL THEN
        RETURN false;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.platform_admins
        WHERE pin_hash IS NOT NULL
          AND pin_hash = crypt(v_clean_pin, pin_hash)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.platform_admins
        WHERE user_id = auth.uid()
           OR (
               NULLIF(auth.jwt() ->> 'email', '') IS NOT NULL
               AND LOWER(email) = LOWER(auth.jwt() ->> 'email')
           )
    );
$$;

-- ============================================================================
-- 3. PLATFORM BANKS (الحسابات البنكية للمنصة - مطابقة لواجهة التحويل البنكي)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,           -- AL_BARID, CHAABI, CIH, TIJJARI, BMCE, CASHPLUS
    short_name TEXT NOT NULL,            -- الاسم الظاهر تحت الشعار
    display_name_ar TEXT NOT NULL,       -- الاسم بالعربية
    account_holder_name TEXT NOT NULL,   -- اسم المستلم
    rib TEXT NOT NULL,                   -- رقم الحساب (24 رقماً)
    logo_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.platform_banks (code, short_name, display_name_ar, account_holder_name, rib, sort_order) VALUES
    ('AL_BARID', 'AL BARID', 'البريد بنك', 'Karya Platform SARL', '350 810 0000000000001234 45', 1),
    ('CHAABI',   'CHAABI',   'البنك الشعبي', 'Karya Platform SARL', '101 780 2111100000005678 12', 2),
    ('CIH',      'CIH',      'CIH Bank',     'Karya Platform SARL', '230 780 0000000000009012 34', 3),
    ('TIJJARI',  'TIJJARI',  'التجاري وفا بنك', 'Karya Platform SARL', '007 780 0000000000003456 78', 4),
    ('BMCE',     'BMCE',     'Bank of Africa', 'Karya Platform SARL', '011 780 0000000000007890 91', 5),
    ('CASHPLUS', 'CASHPLUS', 'كاش بلوس',     'Karya Platform SARL', '840 780 0000000000004321 65', 6)
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- 4. AGENCIES (شركات كراء السيارات / المعلنين)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_phone TEXT,
    city TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- معلومات الحساب البنكي للشركة لاستلام الأرباح (90%)
    bank_name TEXT NOT NULL,
    bank_account_holder TEXT,
    bank_rib TEXT NOT NULL,
    -- توثيق الشركة
    commercial_register TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'suspended')),
    rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    rating_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agencies_city ON public.agencies(city);
CREATE INDEX IF NOT EXISTS idx_agencies_verification ON public.agencies(verification_status);

-- ============================================================================
-- 5. CAR CATALOG (اختياري كمرجع سريع للماركات والموديلات)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.car_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Économique', -- Économique, Berline, SUV, Citadine
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. AGENCY CARS (أسطول السيارات الفعلي بصور الشركة الخاصة وحالة التوفر)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agency_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    catalog_id UUID REFERENCES public.car_catalog(id) ON DELETE SET NULL,
    -- بيانات وصور السيارة الحقيقية المرفوعة من طرف الشركة
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    model_year INTEGER,
    fuel_type TEXT NOT NULL DEFAULT 'diesel'
        CHECK (fuel_type IN ('diesel', 'essence', 'hybrid', 'electric')),
    transmission TEXT NOT NULL DEFAULT 'manual'
        CHECK (transmission IN ('manual', 'automatic')),
    seats INTEGER NOT NULL DEFAULT 5,
    primary_image_url TEXT NOT NULL,
    gallery_images TEXT[] NOT NULL DEFAULT '{}',
    -- التسعير والموقع
    daily_price NUMERIC(10,2) NOT NULL CHECK (daily_price > 0),
    deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- الكفالة/الضمان إن وجد
    city TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    -- الحالة الفورية
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'unavailable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agency_cars_city_status ON public.agency_cars(city, status);
CREATE INDEX IF NOT EXISTS idx_agency_cars_agency ON public.agency_cars(agency_id);

-- ============================================================================
-- 7. BOOKINGS (الطلبات + بيانات الزبون + العمولة 10% + وصل التحويل + الضمان)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code TEXT UNIQUE NOT NULL, -- مثال: KRY-849201
    agency_car_id UUID NOT NULL REFERENCES public.agency_cars(id) ON DELETE RESTRICT,
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE RESTRICT,

    -- بيانات الزبون المطلوبة
    customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_cin TEXT NOT NULL,          -- رقم بطاقة التعريف الوطنية
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_refund_rib TEXT,            -- في حال طلب استرجاع المبلغ كاملاً عند عدم التسليم

    -- تفاصيل الكراء
    days INTEGER NOT NULL CHECK (days >= 1 AND days <= 90),
    daily_price NUMERIC(10,2) NOT NULL,
    delivery_at TIMESTAMPTZ NOT NULL,    -- وقت وتاريخ تسليم السيارة
    delivery_notes TEXT,

    -- الحسابات المالية (تُحسب تلقائياً داخل قاعدة البيانات)
    total_amount NUMERIC(10,2) NOT NULL,
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1000, -- 10%
    commission_amount NUMERIC(10,2) NOT NULL,             -- حصة المنصة (10%)
    agency_payout_amount NUMERIC(10,2) NOT NULL,          -- حصة الشركة (90%)

    -- معلومات التحويل البنكي من الزبون للمنصة
    platform_bank_id UUID REFERENCES public.platform_banks(id),
    selected_bank_code TEXT,
    receipt_url TEXT,                    -- رابط صورة/PDF وصل التحويل
    receipt_uploaded_at TIMESTAMPTZ,

    -- دورة حياة الحجز والضمان المالي
    status TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN (
            'pending_payment',   -- تم إنشاء الطلب وبانتظار رفع وصل التحويل
            'payment_uploaded',  -- رفع العميل وصل التحويل وبانتظار تحقق المنصة
            'payment_verified',  -- تحققت المنصة من وصول المال وبانتظار تسليم السيارة
            'car_delivered',     -- استلم العميل السيارة (تم إطلاق تحويل 90% للشركة)
            'completed',         -- انتهت مدة الكراء
            'refund_requested',  -- العميل لم يستلم السيارة وطلب استرجاع 100%
            'refunded',          -- تم إرجاع 100% من المال للعميل
            'cancelled'          -- ملغي
        )),

    customer_confirmed_pickup BOOLEAN NOT NULL DEFAULT false,
    agency_confirmed_handover BOOLEAN NOT NULL DEFAULT false,
    payment_verified_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    refund_reason TEXT,
    refunded_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS customer_license_number TEXT,
    ADD COLUMN IF NOT EXISTS customer_license_issue_date DATE,
    ADD COLUMN IF NOT EXISTS pickup_location TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_agency_status ON public.bookings(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON public.bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user ON public.bookings(customer_user_id);

-- ============================================================================
-- 8. PAYOUTS & REFUNDS (سجل التحويلات الفورية للشركات 90% أو الاسترجاع للعميل 100%)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
    transfer_type TEXT NOT NULL CHECK (transfer_type IN ('agency_payout', 'customer_refund')),
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
    recipient_name TEXT NOT NULL,
    recipient_bank TEXT NOT NULL,
    recipient_rib TEXT NOT NULL,
    bank_transfer_reference TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    notes TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payouts_booking ON public.payouts(booking_id);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status);

-- ============================================================================
-- 9. TRIGGERS FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_agencies_updated_at ON public.agencies;
CREATE TRIGGER trg_agencies_updated_at
    BEFORE UPDATE ON public.agencies
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agency_cars_updated_at ON public.agency_cars;
CREATE TRIGGER trg_agency_cars_updated_at
    BEFORE UPDATE ON public.agency_cars
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Cities: قراءة عامة للجميع
DROP POLICY IF EXISTS "cities_public_read" ON public.cities;
CREATE POLICY "cities_public_read" ON public.cities
    FOR SELECT USING (is_active = true);

-- Platform Banks: قراءة الحسابات النشطة للعملاء عند الدفع، والإدارة كاملة للأدمن
DROP POLICY IF EXISTS "platform_banks_public_read" ON public.platform_banks;
CREATE POLICY "platform_banks_public_read" ON public.platform_banks
    FOR SELECT USING (is_active = true OR public.is_admin());
DROP POLICY IF EXISTS "platform_banks_admin_all" ON public.platform_banks;
CREATE POLICY "platform_banks_admin_all" ON public.platform_banks
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Platform Admins: يقرأ الأدمن سجله فقط عبر معرفه أو بريده الإلكتروني المسجل
DROP POLICY IF EXISTS "admins_self_read" ON public.platform_admins;
CREATE POLICY "admins_self_read" ON public.platform_admins
    FOR SELECT TO authenticated
    USING (
        auth.uid() = user_id
        OR (
            NULLIF(auth.jwt() ->> 'email', '') IS NOT NULL
            AND LOWER(email) = LOWER(auth.jwt() ->> 'email')
        )
    );

-- Agencies:
--   - العامة يرون فقط اسم الوكالة، المدينة، التقييم للوكالات الموثقة (عبر استعلامات السيارات)
--   - المالك يدير ملف وكالته (باستثناء توثيق نفسه)
--   - الأدمن يدير كل شيء
DROP POLICY IF EXISTS "agencies_public_read_verified" ON public.agencies;
CREATE POLICY "agencies_public_read_verified" ON public.agencies
    FOR SELECT USING (verification_status = 'verified' OR owner_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "agencies_owner_insert" ON public.agencies;
CREATE POLICY "agencies_owner_insert" ON public.agencies
    FOR INSERT WITH CHECK (auth.uid() = owner_id AND verification_status = 'pending');

CREATE OR REPLACE FUNCTION public.get_agency_verification_status(p_agency_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT verification_status FROM public.agencies WHERE id = p_agency_id;
$$;

DROP POLICY IF EXISTS "agencies_owner_update" ON public.agencies;
CREATE POLICY "agencies_owner_update" ON public.agencies
    FOR UPDATE USING (auth.uid() = owner_id OR public.is_admin())
    WITH CHECK (
        public.is_admin()
        OR (auth.uid() = owner_id AND verification_status = public.get_agency_verification_status(id))
    );

-- Car Catalog: قراءة للجميع، تعديل للأدمن فقط
DROP POLICY IF EXISTS "catalog_public_read" ON public.car_catalog;
CREATE POLICY "catalog_public_read" ON public.car_catalog
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_admin_all" ON public.car_catalog;
CREATE POLICY "catalog_admin_all" ON public.car_catalog
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Agency Cars:
--   - العميل يرى السيارات المتاحة للوكالات الموثقة فقط
--   - الوكالة ترى وتعدل وتحذف سياراتها فقط
DROP POLICY IF EXISTS "cars_public_read_available" ON public.agency_cars;
CREATE POLICY "cars_public_read_available" ON public.agency_cars
    FOR SELECT USING (
        (
            status = 'available'
            AND EXISTS (
                SELECT 1 FROM public.agencies a
                WHERE a.id = agency_cars.agency_id AND a.verification_status = 'verified'
            )
        )
        OR EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = agency_cars.agency_id AND a.owner_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "cars_agency_insert" ON public.agency_cars;
CREATE POLICY "cars_agency_insert" ON public.agency_cars
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = agency_id AND a.owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "cars_agency_update" ON public.agency_cars;
CREATE POLICY "cars_agency_update" ON public.agency_cars
    FOR UPDATE
    USING (
        EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = agency_id AND a.owner_id = auth.uid())
        OR public.is_admin()
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = agency_id AND a.owner_id = auth.uid())
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "cars_agency_delete" ON public.agency_cars;
CREATE POLICY "cars_agency_delete" ON public.agency_cars
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = agency_id AND a.owner_id = auth.uid())
        OR public.is_admin()
    );

-- Bookings:
--   1. تقتصر قراءة وتعديل حجوزات كل وكالة على بياناتها الخاصة فقط (owner_id = auth.uid())
--   2. لا يمكن للعميل العادي رؤية سوى حجوزاته المرتبطة بحسابه أو برقم هاتفه
--   3. للأدمن كامل الصلاحيات
DROP POLICY IF EXISTS "bookings_agency_read" ON public.bookings;
CREATE POLICY "bookings_agency_read" ON public.bookings
    FOR SELECT TO authenticated
    USING (
        status IN ('payment_verified', 'car_delivered', 'completed', 'refund_requested', 'refunded')
        AND EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = bookings.agency_id AND a.owner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "bookings_agency_update" ON public.bookings;
CREATE POLICY "bookings_agency_update" ON public.bookings
    FOR UPDATE TO authenticated
    USING (
        status IN ('payment_verified', 'car_delivered')
        AND EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = bookings.agency_id AND a.owner_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = bookings.agency_id AND a.owner_id = auth.uid()
        )
    );

-- منع أي وكالة من تغيير الحقول المالية أو نقل الحجز لوكالة أخرى عند التعديل المباشر
CREATE OR REPLACE FUNCTION public.guard_booking_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN NEW;
    END IF;

    IF NEW.agency_id <> OLD.agency_id
       OR NEW.agency_car_id <> OLD.agency_car_id
       OR NEW.total_amount <> OLD.total_amount
       OR NEW.commission_rate <> OLD.commission_rate
       OR NEW.commission_amount <> OLD.commission_amount
       OR NEW.agency_payout_amount <> OLD.agency_payout_amount
       OR NEW.customer_phone <> OLD.customer_phone
    THEN
        RAISE EXCEPTION 'غير مصرح بتعديل البيانات المالية أو بيانات الملكية للحجز';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_update ON public.bookings;
CREATE TRIGGER trg_guard_booking_update
    BEFORE UPDATE ON public.bookings
    FOR EACH ROW EXECUTE FUNCTION public.guard_booking_update();

DROP POLICY IF EXISTS "bookings_customer_read" ON public.bookings;
CREATE POLICY "bookings_customer_read" ON public.bookings
    FOR SELECT TO authenticated
    USING (
        customer_user_id = auth.uid()
        OR (
            NULLIF(auth.jwt() ->> 'phone', '') IS NOT NULL
            AND customer_phone = (auth.jwt() ->> 'phone')
        )
        OR (
            NULLIF(auth.jwt() ->> 'email', '') IS NOT NULL
            AND LOWER(customer_email) = LOWER(auth.jwt() ->> 'email')
        )
    );

DROP POLICY IF EXISTS "bookings_admin_all" ON public.bookings;
CREATE POLICY "bookings_admin_all" ON public.bookings
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Payouts: ترى الوكالة تحويلاتها فقط، والأدمن يدير كل التحويلات
DROP POLICY IF EXISTS "payouts_agency_read" ON public.payouts;
CREATE POLICY "payouts_agency_read" ON public.payouts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agencies a
            WHERE a.id = payouts.agency_id AND a.owner_id = auth.uid()
        )
        OR public.is_admin()
    );

DROP POLICY IF EXISTS "payouts_admin_all" ON public.payouts;
CREATE POLICY "payouts_admin_all" ON public.payouts
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 11. RPC FUNCTIONS (دوال آمنة للعمليات الأساسية)
-- ============================================================================

-- (أ) البحث عن السيارات المتاحة حسب المدينة أو أقرب موقع GPS (بالمسافة بالكيلومتر)
CREATE OR REPLACE FUNCTION public.get_nearby_cars(
    p_city TEXT DEFAULT NULL,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50
)
RETURNS TABLE (
    car_id UUID,
    brand TEXT,
    model TEXT,
    model_year INTEGER,
    fuel_type TEXT,
    transmission TEXT,
    seats INTEGER,
    primary_image_url TEXT,
    gallery_images TEXT[],
    daily_price NUMERIC,
    deposit_amount NUMERIC,
    city TEXT,
    agency_id UUID,
    agency_name TEXT,
    agency_rating NUMERIC,
    agency_rating_count INTEGER,
    distance_km DOUBLE PRECISION
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        c.id AS car_id,
        c.brand,
        c.model,
        c.model_year,
        c.fuel_type,
        c.transmission,
        c.seats,
        c.primary_image_url,
        c.gallery_images,
        c.daily_price,
        c.deposit_amount,
        c.city,
        a.id AS agency_id,
        a.name AS agency_name,
        a.rating_avg AS agency_rating,
        a.rating_count AS agency_rating_count,
        CASE
            WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL
                 AND COALESCE(c.latitude, a.latitude) IS NOT NULL
                 AND COALESCE(c.longitude, a.longitude) IS NOT NULL
            THEN (
                6371 * acos(
                    LEAST(1.0, GREATEST(-1.0,
                        cos(radians(p_lat)) * cos(radians(COALESCE(c.latitude, a.latitude))) *
                        cos(radians(COALESCE(c.longitude, a.longitude)) - radians(p_lng)) +
                        sin(radians(p_lat)) * sin(radians(COALESCE(c.latitude, a.latitude)))
                    ))
                )
            )
            ELSE NULL
        END AS distance_km
    FROM public.agency_cars c
    JOIN public.agencies a ON a.id = c.agency_id
    WHERE c.status = 'available'
      AND a.verification_status = 'verified'
      AND (p_city IS NULL OR LOWER(c.city) = LOWER(p_city))
    ORDER BY distance_km ASC NULLS LAST, c.created_at DESC;
$$;

-- (ب) إنشاء حجز جديد وحساب المبلغ والعمولة (10%) داخل قاعدة البيانات
DROP FUNCTION IF EXISTS public.create_booking(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_booking(
    p_agency_car_id UUID,
    p_customer_name TEXT,
    p_customer_cin TEXT,
    p_customer_phone TEXT,
    p_days INTEGER,
    p_delivery_at TIMESTAMPTZ,
    p_platform_bank_id UUID DEFAULT NULL,
    p_customer_email TEXT DEFAULT NULL,
    p_delivery_notes TEXT DEFAULT NULL,
    p_customer_license_number TEXT DEFAULT NULL,
    p_customer_license_issue_date DATE DEFAULT NULL,
    p_pickup_location TEXT DEFAULT NULL
)
RETURNS TABLE (
    booking_id UUID,
    booking_code TEXT,
    total_amount NUMERIC,
    commission_amount NUMERIC,
    agency_payout_amount NUMERIC,
    bank_code TEXT,
    bank_holder_name TEXT,
    bank_rib TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_car RECORD;
    v_bank_id UUID := NULL;
    v_bank_code TEXT := NULL;
    v_bank_holder TEXT := NULL;
    v_bank_rib TEXT := NULL;
    v_total NUMERIC(10,2);
    v_commission NUMERIC(10,2);
    v_payout NUMERIC(10,2);
    v_code TEXT;
    v_booking_id UUID;
BEGIN
    IF p_days < 1 OR p_days > 90 THEN
        RAISE EXCEPTION 'عدد الأيام يجب أن يكون بين 1 و 90 يوماً';
    END IF;

    SELECT c.*, a.verification_status
    INTO v_car
    FROM public.agency_cars c
    JOIN public.agencies a ON a.id = c.agency_id
    WHERE c.id = p_agency_car_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'السيارة غير موجودة';
    END IF;

    IF v_car.status <> 'available' THEN
        RAISE EXCEPTION 'عذراً، هذه السيارة غير متاحة حالياً';
    END IF;

    IF v_car.verification_status <> 'verified' THEN
        RAISE EXCEPTION 'هذه الوكالة غير مفعلة بعد';
    END IF;

    IF p_platform_bank_id IS NOT NULL THEN
        SELECT id, code, account_holder_name, rib
        INTO v_bank_id, v_bank_code, v_bank_holder, v_bank_rib
        FROM public.platform_banks
        WHERE id = p_platform_bank_id AND is_active = true;
    END IF;

    v_total := ROUND(v_car.daily_price * p_days, 2);
    v_commission := ROUND(v_total * 0.10, 2);
    v_payout := v_total - v_commission;
    v_code := 'KRY-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 6));

    INSERT INTO public.bookings (
        booking_code,
        agency_car_id,
        agency_id,
        customer_user_id,
        customer_name,
        customer_cin,
        customer_phone,
        customer_email,
        customer_license_number,
        customer_license_issue_date,
        pickup_location,
        days,
        daily_price,
        delivery_at,
        delivery_notes,
        total_amount,
        commission_rate,
        commission_amount,
        agency_payout_amount,
        platform_bank_id,
        selected_bank_code,
        status
    ) VALUES (
        v_code,
        v_car.id,
        v_car.agency_id,
        auth.uid(),
        TRIM(p_customer_name),
        UPPER(TRIM(p_customer_cin)),
        TRIM(p_customer_phone),
        p_customer_email,
        NULLIF(UPPER(TRIM(COALESCE(p_customer_license_number, ''))), ''),
        p_customer_license_issue_date,
        NULLIF(TRIM(COALESCE(p_pickup_location, '')), ''),
        p_days,
        v_car.daily_price,
        p_delivery_at,
        p_delivery_notes,
        v_total,
        0.1000,
        v_commission,
        v_payout,
        v_bank_id,
        v_bank_code,
        'pending_payment'
    )
    RETURNING id INTO v_booking_id;

    RETURN QUERY SELECT
        v_booking_id,
        v_code,
        v_total,
        v_commission,
        v_payout,
        v_bank_code,
        v_bank_holder,
        v_bank_rib;
END;
$$;

-- (ج) إرفاق وصل التحويل البنكي من طرف العميل واختيار البنك
CREATE OR REPLACE FUNCTION public.submit_payment_receipt(
    p_booking_id UUID,
    p_booking_code TEXT,
    p_platform_bank_id UUID,
    p_receipt_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_bank RECORD;
    v_updated INTEGER;
BEGIN
    SELECT * INTO v_bank
    FROM public.platform_banks
    WHERE id = p_platform_bank_id AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'البنك المختار غير متاح';
    END IF;

    UPDATE public.bookings
    SET
        platform_bank_id = v_bank.id,
        selected_bank_code = v_bank.code,
        receipt_url = p_receipt_url,
        receipt_uploaded_at = NOW(),
        status = 'payment_uploaded'
    WHERE id = p_booking_id
      AND booking_code = p_booking_code
      AND status IN ('pending_payment', 'payment_uploaded');

    GET DIAGNOSTICS v_updated = ROW_COUNT;
    IF v_updated = 0 THEN
        RAISE EXCEPTION 'الحجز غير موجود أو لا يمكن تعديل وصل الدفع في هذه المرحلة';
    END IF;

    RETURN true;
END;
$$;

-- (د) تأكيد استلام المال من طرف الأدمن (يفتح الحجز للوكالة)
CREATE OR REPLACE FUNCTION public.admin_verify_payment(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    UPDATE public.bookings
    SET status = 'payment_verified',
        payment_verified_at = NOW()
    WHERE id = p_booking_id
      AND status = 'payment_uploaded';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الحجز غير جاهز للتحقق من الدفع';
    END IF;

    RETURN true;
END;
$$;

-- (هـ) تأكيد تسليم السيارة (تأخذ الوكالة الـ 90% المتبقية مباشرة من العميل عند التسليم)
CREATE OR REPLACE FUNCTION public.confirm_car_delivery(p_booking_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking RECORD;
    v_agency RECORD;
BEGIN
    SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
    IF NOT FOUND OR v_booking.status <> 'payment_verified' THEN
        RAISE EXCEPTION 'لا يمكن تأكيد التسليم قبل تأكيد دفع العربون';
    END IF;

    SELECT * INTO v_agency FROM public.agencies WHERE id = v_booking.agency_id;

    -- السماح للأدمن أو لصاحب الوكالة بتأكيد التسليم
    IF NOT (public.is_admin() OR v_agency.owner_id = auth.uid()) THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    UPDATE public.bookings
    SET status = 'car_delivered',
        delivered_at = NOW(),
        agency_confirmed_handover = true
    WHERE id = p_booking_id;

    RETURN v_booking.id;
END;
$$;

-- (و) طلب استرجاع العربون كاملاً (100% من العربون المدفوع) للعميل إذا لم يستلم سيارته
CREATE OR REPLACE FUNCTION public.request_full_refund(
    p_booking_id UUID,
    p_booking_code TEXT,
    p_customer_rib TEXT,
    p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking RECORD;
    v_payout_id UUID;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND booking_code = p_booking_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'بيانات الحجز غير صحيحة';
    END IF;

    IF v_booking.status NOT IN ('payment_uploaded', 'payment_verified') THEN
        RAISE EXCEPTION 'لا يمكن طلب الاسترجاع في هذه الحالة';
    END IF;

    UPDATE public.bookings
    SET status = 'refund_requested',
        customer_refund_rib = TRIM(p_customer_rib),
        refund_reason = p_reason
    WHERE id = p_booking_id;

    INSERT INTO public.payouts (
        booking_id,
        transfer_type,
        agency_id,
        amount,
        recipient_name,
        recipient_bank,
        recipient_rib,
        status,
        notes
    ) VALUES (
        v_booking.id,
        'customer_refund',
        v_booking.agency_id,
        v_booking.commission_amount,
        v_booking.customer_name,
        COALESCE(v_booking.selected_bank_code, 'Customer Bank'),
        TRIM(p_customer_rib),
        'pending',
        'استرجاع كامل مبلغ العربون (10%) للعميل لعدم تسليم السيارة: ' || COALESCE(p_reason, '')
    )
    RETURNING id INTO v_payout_id;

    RETURN v_payout_id;
END;
$$;

-- (ز) استرجاع حجوزات العميل المرتبطة برقم هاتفه ورمز الحجز بأمان
CREATE OR REPLACE FUNCTION public.get_customer_booking_by_phone(
    p_booking_code TEXT,
    p_customer_phone TEXT
)
RETURNS TABLE (
    booking_id UUID,
    booking_code TEXT,
    car_label TEXT,
    agency_name TEXT,
    city TEXT,
    days INTEGER,
    total_amount NUMERIC,
    commission_amount NUMERIC,
    agency_payout_amount NUMERIC,
    delivery_at TIMESTAMPTZ,
    status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        b.id AS booking_id,
        b.booking_code,
        (c.brand || ' ' || c.model) AS car_label,
        a.name AS agency_name,
        c.city,
        b.days,
        b.total_amount,
        b.commission_amount,
        b.agency_payout_amount,
        b.delivery_at,
        b.status
    FROM public.bookings b
    JOIN public.agency_cars c ON c.id = b.agency_car_id
    JOIN public.agencies a ON a.id = b.agency_id
    WHERE UPPER(TRIM(b.booking_code)) = UPPER(TRIM(p_booking_code))
      AND REGEXP_REPLACE(b.customer_phone, '\s+', '', 'g') = REGEXP_REPLACE(p_customer_phone, '\s+', '', 'g');
$$;

-- منح الصلاحيات لاستدعاء دوال الزبناء والبحث من الواجهة
GRANT EXECUTE ON FUNCTION public.get_nearby_cars(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, DATE, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_receipt(UUID, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_full_refund(UUID, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_booking_by_phone(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_pin(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_payment(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_car_delivery(UUID) TO authenticated;

-- ============================================================================
-- 12. SUPABASE STORAGE BUCKETS (صور السيارات + وصولات التحويل البنكي)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('car-photos', 'car-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('payment-receipts', 'payment-receipts', false, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- سياسات صور السيارات: قراءة للجميع، رفع وحذف لأصحاب الوكالات فقط
DROP POLICY IF EXISTS "car_photos_public_read" ON storage.objects;
CREATE POLICY "car_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-photos');

DROP POLICY IF EXISTS "car_photos_agency_upload" ON storage.objects;
CREATE POLICY "car_photos_agency_upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'car-photos');

DROP POLICY IF EXISTS "car_photos_agency_delete" ON storage.objects;
CREATE POLICY "car_photos_agency_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'car-photos' AND owner = auth.uid());

-- سياسات وصولات التحويل البنكي: رفع للجميع (JPG/PNG/PDF حتى 5MB)، وقراءة للأدمن فقط لحماية خصوصية الزبناء
DROP POLICY IF EXISTS "receipts_anyone_upload" ON storage.objects;
CREATE POLICY "receipts_anyone_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "receipts_admin_read" ON storage.objects;
CREATE POLICY "receipts_admin_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-receipts' AND public.is_admin());
