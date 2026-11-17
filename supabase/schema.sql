-- ============================================================================
-- Karya Morocco - Compatible Supabase PostgreSQL Schema (Local Economic Edition)
-- Supports:
--   1. Moroccan Cities & GPS Proximity Search (Haversine)
--   2. Central Economic Car Catalog (Admin-curated, max 50 models by Brand)
--   3. Rental Agencies (Phone + PIN auth, NO email activation, NO bank RIB,
--      Mandatory Pledge: Zero Deposit + 10% Platform Commission, Full Cloud Sync)
--   4. Zero Deposit Mandate (deposit_amount = 0) & Minimum 3-Day Rental (days >= 3)
--   5. Strict 2-Year Driver License Seniority Check + 10% Advance Checkout
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
-- 2. PLATFORM ADMINS (مسؤولو المنصة لمراجعة الوصولات، الكتالوج، وتوثيق الوكالات)
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

CREATE OR REPLACE FUNCTION public.is_admin_or_pin(p_admin_pin TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF public.is_admin() THEN
        RETURN true;
    END IF;
    IF NULLIF(TRIM(COALESCE(p_admin_pin, '')), '') IS NOT NULL THEN
        RETURN public.verify_admin_pin(p_admin_pin);
    END IF;
    RETURN false;
END;
$$;

-- ============================================================================
-- 3. PLATFORM BANKS (الحسابات البنكية للمنصة لاستلام تسبيق 10%)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.platform_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    short_name TEXT NOT NULL,
    display_name_ar TEXT NOT NULL,
    account_holder_name TEXT NOT NULL,
    rib TEXT NOT NULL,
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
-- 4. AGENCIES (وكالات كراء السيارات — دخول برقم الهاتف + الرمز السري بدون RIB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp_phone TEXT,
    city TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    pin_hash TEXT,
    terms_accepted_at TIMESTAMPTZ,
    -- حقول اختيارية قديمة للتوافق فقط (لم تعد مطلوبة لأن الوكالة تحصل 90% مباشرة)
    bank_name TEXT DEFAULT '',
    bank_account_holder TEXT DEFAULT '',
    bank_rib TEXT DEFAULT '',
    commercial_register TEXT,
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'verified', 'suspended')),
    rating_avg NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    rating_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ترقية آمنة لجداول الوكالات القائمة مسبقاً
ALTER TABLE public.agencies
    ALTER COLUMN owner_id DROP NOT NULL,
    ALTER COLUMN bank_name DROP NOT NULL,
    ALTER COLUMN bank_name SET DEFAULT '',
    ALTER COLUMN bank_rib DROP NOT NULL,
    ALTER COLUMN bank_rib SET DEFAULT '';

ALTER TABLE public.agencies
    ADD COLUMN IF NOT EXISTS pin_hash TEXT,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS strike_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_strike_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agencies_city ON public.agencies(city);
CREATE INDEX IF NOT EXISTS idx_agencies_verification ON public.agencies(verification_status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_phone_normalized
    ON public.agencies (REGEXP_REPLACE(phone, '[^0-9]', '', 'g'));

-- ============================================================================
-- 5. CENTRAL ECONOMIC CAR CATALOG (الكتالوج المركزي: 30-50 سيارة اقتصادية كحد أقصى)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.car_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Économique',
    seats INTEGER NOT NULL DEFAULT 5,
    default_fuel TEXT NOT NULL DEFAULT 'diesel'
        CHECK (default_fuel IN ('diesel', 'essence', 'hybrid', 'electric')),
    default_transmission TEXT NOT NULL DEFAULT 'manual'
        CHECK (default_transmission IN ('manual', 'automatic')),
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.car_catalog
    ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS default_fuel TEXT NOT NULL DEFAULT 'diesel',
    ADD COLUMN IF NOT EXISTS default_transmission TEXT NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS idx_car_catalog_brand_model
    ON public.car_catalog (LOWER(TRIM(brand)), LOWER(TRIM(model)));

-- حد أقصى 50 سيارة في الكتالوج المركزي للحفاظ على جودة الاختيارات الاقتصادية
CREATE OR REPLACE FUNCTION public.enforce_catalog_max_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.car_catalog;
    IF v_count >= 50 THEN
        RAISE EXCEPTION 'تم بلوغ الحد الأقصى للكتالوج المركزي (50 سيارة اقتصادية). يرجى حذف موديل قديم قبل إضافة جديد.';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_car_catalog_max_limit ON public.car_catalog;
CREATE TRIGGER trg_car_catalog_max_limit
    BEFORE INSERT ON public.car_catalog
    FOR EACH ROW EXECUTE FUNCTION public.enforce_catalog_max_limit();

-- بذور أولية لموديلات اقتصادية شائعة في المغرب
INSERT INTO public.car_catalog (brand, model, category, seats, default_fuel, default_transmission, image_url) VALUES
    ('Dacia', 'Sandero Stepway', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Dacia', 'Logan', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Dacia', 'Duster', 'SUV Économique', 5, 'diesel', 'manual', NULL),
    ('Renault', 'Clio 5', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Renault', 'Megane 4', 'Berline Économique', 5, 'diesel', 'automatic', NULL),
    ('Peugeot', '208', 'Économique', 5, 'essence', 'manual', NULL),
    ('Peugeot', '301', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Ford', 'Fiesta', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Ford', 'Focus', 'Berline Économique', 5, 'diesel', 'manual', NULL),
    ('Hyundai', 'i10', 'Citadine', 5, 'essence', 'manual', NULL),
    ('Hyundai', 'i20', 'Économique', 5, 'essence', 'automatic', NULL),
    ('Citroën', 'C3', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Fiat', '500', 'Citadine', 4, 'essence', 'manual', NULL),
    ('Volkswagen', 'Polo', 'Économique', 5, 'diesel', 'manual', NULL),
    ('Volkswagen', 'Golf 8', 'Berline Économique', 5, 'diesel', 'automatic', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. AGENCY CARS (سيارات الوكالات المرتبطة بالكتالوج المركزي — بدون ضمان 0 DH)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.agency_cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
    catalog_id UUID REFERENCES public.car_catalog(id) ON DELETE SET NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    model_year INTEGER,
    color TEXT,
    fuel_type TEXT NOT NULL DEFAULT 'diesel'
        CHECK (fuel_type IN ('diesel', 'essence', 'hybrid', 'electric')),
    transmission TEXT NOT NULL DEFAULT 'manual'
        CHECK (transmission IN ('manual', 'automatic')),
    seats INTEGER NOT NULL DEFAULT 5,
    primary_image_url TEXT NOT NULL,
    gallery_images TEXT[] NOT NULL DEFAULT '{}',
    -- التسعير حر بدون سقف، والضمان 0 درهم إلزامياً
    daily_price NUMERIC(10,2) NOT NULL CHECK (daily_price > 0),
    deposit_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (deposit_amount = 0),
    city TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    status TEXT NOT NULL DEFAULT 'available'
        CHECK (status IN ('available', 'unavailable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.agency_cars
    ADD COLUMN IF NOT EXISTS color TEXT;

-- توحيد الضمان إلى 0 درهم لأي بيانات قائمة مسبقاً وتطبيق قيد 0 DH
UPDATE public.agency_cars SET deposit_amount = 0 WHERE deposit_amount <> 0;
ALTER TABLE public.agency_cars DROP CONSTRAINT IF EXISTS agency_cars_deposit_zero_check;
ALTER TABLE public.agency_cars ADD CONSTRAINT agency_cars_deposit_zero_check CHECK (deposit_amount = 0);

CREATE INDEX IF NOT EXISTS idx_agency_cars_city_status ON public.agency_cars(city, status);
CREATE INDEX IF NOT EXISTS idx_agency_cars_agency ON public.agency_cars(agency_id);

-- ============================================================================
-- 7. BOOKINGS (الحجوزات: حد أدنى 3 أيام + أقدمية رخصة سنتان + تسبيق 10%)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code TEXT UNIQUE NOT NULL,
    agency_car_id UUID REFERENCES public.agency_cars(id) ON DELETE SET NULL,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,

    customer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    customer_cin TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_refund_rib TEXT,
    customer_license_number TEXT,
    customer_license_issue_date DATE,
    pickup_location TEXT,

    days INTEGER NOT NULL CHECK (days >= 3 AND days <= 90),
    daily_price NUMERIC(10,2) NOT NULL,
    delivery_at TIMESTAMPTZ NOT NULL,
    delivery_notes TEXT,

    total_amount NUMERIC(10,2) NOT NULL,
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1000,
    commission_amount NUMERIC(10,2) NOT NULL,
    agency_payout_amount NUMERIC(10,2) NOT NULL,

    platform_bank_id UUID REFERENCES public.platform_banks(id),
    selected_bank_code TEXT,
    receipt_url TEXT,
    receipt_uploaded_at TIMESTAMPTZ,

    status TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (status IN (
            'pending_payment',
            'payment_uploaded',
            'payment_verified',
            'car_delivered',
            'completed',
            'refund_requested',
            'refunded',
            'cancelled'
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
    ADD COLUMN IF NOT EXISTS pickup_location TEXT,
    ADD COLUMN IF NOT EXISTS agency_ack_status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS agency_ack_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS agency_ack_note TEXT,
    ADD COLUMN IF NOT EXISTS reassigned_from_agency_id UUID REFERENCES public.agencies(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dispute_flag TEXT,
    ADD COLUMN IF NOT EXISTS refund_allowed_by_admin BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_agency_ack_status_check;
ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_agency_ack_status_check
    CHECK (agency_ack_status IN ('pending', 'available', 'unavailable'));

-- السماح بحذف السيارة أو الوكالة عند عدم وجود حجوزات نشطة عبر ON DELETE SET NULL
ALTER TABLE public.bookings ALTER COLUMN agency_car_id DROP NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN agency_id DROP NOT NULL;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_agency_car_id_fkey;
ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_agency_car_id_fkey
    FOREIGN KEY (agency_car_id) REFERENCES public.agency_cars(id) ON DELETE SET NULL;
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_agency_id_fkey;
ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_agency_id_fkey
    FOREIGN KEY (agency_id) REFERENCES public.agencies(id) ON DELETE SET NULL;

-- تحديث قيد الأيام الأدنى إلى 3 أيام في الجداول القائمة
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_days_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_days_check CHECK (days >= 3 AND days <= 90) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_bookings_agency_status ON public.bookings(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON public.bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON public.bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_user ON public.bookings(customer_user_id);

-- ============================================================================
-- 8. PAYOUTS & REFUNDS (سجل استرجاع التسبيق للعملاء)
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

DROP POLICY IF EXISTS "cities_public_read" ON public.cities;
CREATE POLICY "cities_public_read" ON public.cities
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "platform_banks_public_read" ON public.platform_banks;
CREATE POLICY "platform_banks_public_read" ON public.platform_banks
    FOR SELECT USING (is_active = true OR public.is_admin());
DROP POLICY IF EXISTS "platform_banks_admin_all" ON public.platform_banks;
CREATE POLICY "platform_banks_admin_all" ON public.platform_banks
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

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

DROP POLICY IF EXISTS "catalog_public_read" ON public.car_catalog;
CREATE POLICY "catalog_public_read" ON public.car_catalog
    FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_admin_all" ON public.car_catalog;
CREATE POLICY "catalog_admin_all" ON public.car_catalog
    FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

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

    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id
       OR NEW.agency_car_id IS DISTINCT FROM OLD.agency_car_id
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
-- 11. RPC FUNCTIONS (عمليات العملاء + الوكالات برقم الهاتف والرمز السري + الإدارة)
-- ============================================================================

-- (أ) البحث عن السيارات المتاحة حسب المدينة والتواريخ (بدون ضمان — مع إظهار السيارات المحجوزة)
DROP FUNCTION IF EXISTS public.get_nearby_cars(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION);
DROP FUNCTION IF EXISTS public.get_nearby_cars(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, INTEGER);
CREATE OR REPLACE FUNCTION public.get_nearby_cars(
    p_city TEXT DEFAULT NULL,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_radius_km DOUBLE PRECISION DEFAULT 50,
    p_pickup_at TIMESTAMPTZ DEFAULT NULL,
    p_days INTEGER DEFAULT 3
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
    distance_km DOUBLE PRECISION,
    is_booked BOOLEAN,
    booked_until TIMESTAMPTZ
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
        0::NUMERIC AS deposit_amount,
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
        END AS distance_km,
        COALESCE(bk.is_booked, false) AS is_booked,
        bk.booked_until
    FROM public.agency_cars c
    JOIN public.agencies a ON a.id = c.agency_id
    LEFT JOIN LATERAL (
        SELECT
            true AS is_booked,
            MAX(b.delivery_at + (b.days * INTERVAL '1 day')) AS booked_until
        FROM public.bookings b
        WHERE b.agency_car_id = c.id
          AND b.status IN ('payment_uploaded', 'payment_verified', 'car_delivered')
          AND b.delivery_at < (
              COALESCE(p_pickup_at, NOW()) + (GREATEST(COALESCE(p_days, 3), 3) * INTERVAL '1 day')
          )
          AND (b.delivery_at + (b.days * INTERVAL '1 day')) > COALESCE(p_pickup_at, NOW())
        GROUP BY b.agency_car_id
    ) bk ON true
    WHERE c.status = 'available'
      AND a.verification_status = 'verified'
      AND (p_city IS NULL OR LOWER(c.city) = LOWER(p_city))
    ORDER BY COALESCE(bk.is_booked, false) ASC, distance_km ASC NULLS LAST, c.created_at DESC;
$$;

-- (ب) إنشاء حجز جديد (الحد الأدنى 3 أيام + أقدمية رخصة سنتين + تسبيق 10%)
DROP FUNCTION IF EXISTS public.create_booking(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.create_booking(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, DATE, TEXT);
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
    v_norm_phone TEXT := REGEXP_REPLACE(COALESCE(p_customer_phone, ''), '[^0-9]', '', 'g');
    v_norm_cin TEXT := UPPER(TRIM(COALESCE(p_customer_cin, '')));
    v_pending_count INTEGER;
    v_end_at TIMESTAMPTZ;
BEGIN
    IF p_days < 3 OR p_days > 90 THEN
        RAISE EXCEPTION 'الحد الأدنى للكراء هو 3 أيام (من 3 إلى 90 يوماً)';
    END IF;

    IF p_customer_license_issue_date IS NULL
       OR p_customer_license_issue_date > (CURRENT_DATE - INTERVAL '2 years') THEN
        RAISE EXCEPTION 'تشترط المنصة أقدمية رخصة سياقة لا تقل عن سنتين (24 شهراً) للاستفادة من الكراء بدون ضمان';
    END IF;

    -- تنظيف تلقائي للحجوزات منتهية الصلاحية التي لم يُرفع وصلها خلال ساعتين
    UPDATE public.bookings
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE status = 'pending_payment'
      AND expires_at IS NOT NULL
      AND expires_at < NOW();

    -- منع إغراق النظام أو تعطيل أسطول الوكالات بحجوزات معلقة متعددة لنفس العميل
    SELECT COUNT(*) INTO v_pending_count
    FROM public.bookings b
    WHERE b.status IN ('pending_payment', 'payment_uploaded')
      AND (
          (LENGTH(v_norm_phone) >= 8 AND REGEXP_REPLACE(b.customer_phone, '[^0-9]', '', 'g') = v_norm_phone)
          OR (LENGTH(v_norm_cin) >= 4 AND UPPER(TRIM(b.customer_cin)) = v_norm_cin)
      );

    IF v_pending_count >= 2 THEN
        RAISE EXCEPTION 'لديك طلبان قيد المعالجة حالياً. يرجى إتمامهما أو انتظار المراجعة قبل إنشاء حجز جديد.';
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

    -- منع تضارب التواريخ لنفس السيارة (Double-Booking Prevention)
    v_end_at := p_delivery_at + (p_days * INTERVAL '1 day');
    IF EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.agency_car_id = v_car.id
          AND b.status IN ('payment_uploaded', 'payment_verified', 'car_delivered')
          AND b.delivery_at < v_end_at
          AND (b.delivery_at + (b.days * INTERVAL '1 day')) > p_delivery_at
    ) THEN
        RAISE EXCEPTION 'عذراً، هذه السيارة محجوزة بالفعل في التواريخ المختارة. يرجى اختيار تاريخ آخر أو سيارة بديلة.';
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
        expires_at,
        status
    ) VALUES (
        v_code,
        v_car.id,
        v_car.agency_id,
        auth.uid(),
        TRIM(p_customer_name),
        v_norm_cin,
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
        NOW() + INTERVAL '2 hours',
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
        expires_at = NULL,
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

-- (د) تسجيل وكالة جديدة برقم الهاتف + الرمز السري + الإقرار الإلزامي (بدون بريد أو RIB)
CREATE OR REPLACE FUNCTION public.register_agency_by_phone(
    p_name TEXT,
    p_phone TEXT,
    p_city TEXT,
    p_pin TEXT,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL,
    p_terms_accepted BOOLEAN DEFAULT false
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    verification_status TEXT,
    rating_avg NUMERIC,
    rating_count INTEGER,
    terms_accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_norm_phone TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    v_clean_pin TEXT := TRIM(COALESCE(p_pin, ''));
    v_agency RECORD;
BEGIN
    IF NOT COALESCE(p_terms_accepted, false) THEN
        RAISE EXCEPTION 'يجب الموافقة على الإقرار الإلزامي (بدون ضمان + عمولة 10%% للمنصة) قبل التسجيل.';
    END IF;

    IF LENGTH(TRIM(COALESCE(p_name, ''))) < 2 THEN
        RAISE EXCEPTION 'يرجى إدخال اسم الوكالة الصحيح.';
    END IF;

    IF LENGTH(v_norm_phone) < 9 THEN
        RAISE EXCEPTION 'يرجى إدخال رقم هاتف مغربي صحيح.';
    END IF;

    IF LENGTH(v_clean_pin) < 4 THEN
        RAISE EXCEPTION 'الرمز السري يجب أن يتكون من 4 رموز أو أرقام على الأقل.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g') = v_norm_phone
    ) THEN
        RAISE EXCEPTION 'رقم الهاتف هذا مسجل مسبقاً. يرجى تسجيل الدخول مباشرة.';
    END IF;

    INSERT INTO public.agencies (
        name,
        phone,
        city,
        latitude,
        longitude,
        pin_hash,
        terms_accepted_at,
        bank_name,
        bank_rib,
        verification_status
    ) VALUES (
        TRIM(p_name),
        TRIM(p_phone),
        TRIM(p_city),
        p_lat,
        p_lng,
        crypt(v_clean_pin, gen_salt('bf')),
        NOW(),
        '',
        '',
        'pending'
    )
    RETURNING * INTO v_agency;

    RETURN QUERY SELECT
        v_agency.id,
        v_agency.name,
        v_agency.phone,
        v_agency.city,
        v_agency.latitude,
        v_agency.longitude,
        v_agency.verification_status,
        v_agency.rating_avg,
        v_agency.rating_count,
        v_agency.terms_accepted_at;
END;
$$;

-- (هـ) دخول الوكالة برقم الهاتف والرمز السري
CREATE OR REPLACE FUNCTION public.login_agency_by_phone(
    p_phone TEXT,
    p_pin TEXT
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    verification_status TEXT,
    rating_avg NUMERIC,
    rating_count INTEGER,
    terms_accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_norm_phone TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    v_clean_pin TEXT := TRIM(COALESCE(p_pin, ''));
    v_agency RECORD;
BEGIN
    SELECT * INTO v_agency
    FROM public.agencies a
    WHERE REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g') = v_norm_phone
      AND a.pin_hash IS NOT NULL
      AND a.pin_hash = crypt(v_clean_pin, a.pin_hash);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'رقم الهاتف أو الرمز السري غير صحيح.';
    END IF;

    RETURN QUERY SELECT
        v_agency.id,
        v_agency.name,
        v_agency.phone,
        v_agency.city,
        v_agency.latitude,
        v_agency.longitude,
        v_agency.verification_status,
        v_agency.rating_avg,
        v_agency.rating_count,
        v_agency.terms_accepted_at;
END;
$$;

-- دالة مساعدة للتحقق من جلسة الوكالة (برقم الهاتف + PIN)
CREATE OR REPLACE FUNCTION public.verify_agency_credentials(
    p_agency_id UUID,
    p_pin TEXT
)
RETURNS public.agencies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
BEGIN
    SELECT * INTO v_agency
    FROM public.agencies a
    WHERE a.id = p_agency_id
      AND (
          (a.pin_hash IS NOT NULL AND a.pin_hash = crypt(TRIM(COALESCE(p_pin, '')), a.pin_hash))
          OR a.owner_id = auth.uid()
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION 'تعذر التحقق من صلاحية الوكالة. يرجى إعادة تسجيل الدخول.';
    END IF;

    RETURN v_agency;
END;
$$;

-- (و) جلب أسطول الوكالة من السحابة
CREATE OR REPLACE FUNCTION public.agency_get_cars(
    p_agency_id UUID,
    p_pin TEXT
)
RETURNS SETOF public.agency_cars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);
    RETURN QUERY
    SELECT * FROM public.agency_cars
    WHERE agency_id = v_agency.id
    ORDER BY created_at DESC;
END;
$$;

-- (ز) إضافة سيارة للوكالة انطلاقاً من الكتالوج المركزي فقط (بدون ضمان 0 DH، بدون سقف للسعر)
CREATE OR REPLACE FUNCTION public.agency_add_catalog_car(
    p_agency_id UUID,
    p_pin TEXT,
    p_catalog_id UUID,
    p_brand TEXT,
    p_model TEXT,
    p_image_url TEXT,
    p_fuel_type TEXT,
    p_transmission TEXT,
    p_daily_price NUMERIC,
    p_model_year INTEGER DEFAULT 2025,
    p_seats INTEGER DEFAULT 5,
    p_color TEXT DEFAULT NULL
)
RETURNS public.agency_cars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_catalog RECORD;
    v_brand TEXT;
    v_model TEXT;
    v_img TEXT;
    v_seats INTEGER;
    v_inserted public.agency_cars;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF p_daily_price IS NULL OR p_daily_price <= 0 THEN
        RAISE EXCEPTION 'يرجى إدخال سعر يومي صالح أكبر من 0 درهم.';
    END IF;

    IF p_catalog_id IS NOT NULL THEN
        SELECT * INTO v_catalog FROM public.car_catalog WHERE id = p_catalog_id;
    END IF;

    v_brand := COALESCE(v_catalog.brand, NULLIF(TRIM(p_brand), ''));
    v_model := COALESCE(v_catalog.model, NULLIF(TRIM(p_model), ''));
    v_img := COALESCE(NULLIF(TRIM(v_catalog.image_url), ''), NULLIF(TRIM(p_image_url), ''));
    v_seats := COALESCE(v_catalog.seats, p_seats, 5);

    IF v_brand IS NULL OR v_model IS NULL OR v_img IS NULL THEN
        RAISE EXCEPTION 'يجب اختيار السيارة من الكتالوج المركزي للمنصة.';
    END IF;

    INSERT INTO public.agency_cars (
        agency_id,
        catalog_id,
        brand,
        model,
        model_year,
        color,
        fuel_type,
        transmission,
        seats,
        primary_image_url,
        gallery_images,
        daily_price,
        deposit_amount,
        city,
        latitude,
        longitude,
        status
    ) VALUES (
        v_agency.id,
        v_catalog.id,
        v_brand,
        v_model,
        p_model_year,
        NULLIF(TRIM(COALESCE(p_color, '')), ''),
        p_fuel_type,
        p_transmission,
        v_seats,
        v_img,
        ARRAY[v_img],
        p_daily_price,
        0,
        v_agency.city,
        v_agency.latitude,
        v_agency.longitude,
        'available'
    )
    RETURNING * INTO v_inserted;

    RETURN v_inserted;
END;
$$;

-- (ح) تعديل السعر اليومي أو حالة التوفر لسيارة الوكالة
CREATE OR REPLACE FUNCTION public.agency_update_car(
    p_agency_id UUID,
    p_pin TEXT,
    p_car_id UUID,
    p_daily_price NUMERIC DEFAULT NULL,
    p_status TEXT DEFAULT NULL
)
RETURNS public.agency_cars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_updated public.agency_cars;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF p_daily_price IS NOT NULL AND p_daily_price <= 0 THEN
        RAISE EXCEPTION 'السعر اليومي يجب أن يكون أكبر من 0 درهم.';
    END IF;

    UPDATE public.agency_cars
    SET
        daily_price = COALESCE(p_daily_price, daily_price),
        status = COALESCE(p_status, status),
        deposit_amount = 0
    WHERE id = p_car_id
      AND agency_id = v_agency.id
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'السيارة غير موجودة ضمن أسطول وكالتك.';
    END IF;

    RETURN v_updated;
END;
$$;

-- (ط) حذف سيارة من أسطول الوكالة
CREATE OR REPLACE FUNCTION public.agency_delete_car(
    p_agency_id UUID,
    p_pin TEXT,
    p_car_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_deleted INTEGER;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE agency_car_id = p_car_id
          AND status IN ('payment_uploaded', 'payment_verified', 'car_delivered', 'refund_requested')
    ) THEN
        RAISE EXCEPTION 'لا يمكن حذف سيارة مرتبطة بحجوزات نشطة حالياً. يمكنك جعلها غير متاحة مؤقتاً.';
    END IF;

    DELETE FROM public.agency_cars
    WHERE id = p_car_id AND agency_id = v_agency.id;

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$$;

-- (ي) تحديث بيانات الوكالة الأساسية (الاسم، الهاتف، المدينة، الموقع)
CREATE OR REPLACE FUNCTION public.agency_update_profile(
    p_agency_id UUID,
    p_pin TEXT,
    p_name TEXT,
    p_phone TEXT,
    p_city TEXT,
    p_lat DOUBLE PRECISION DEFAULT NULL,
    p_lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    city TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    verification_status TEXT,
    rating_avg NUMERIC,
    rating_count INTEGER,
    terms_accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_norm_phone TEXT := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');
    v_updated public.agencies;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF EXISTS (
        SELECT 1 FROM public.agencies a
        WHERE a.id <> v_agency.id
          AND REGEXP_REPLACE(a.phone, '[^0-9]', '', 'g') = v_norm_phone
    ) THEN
        RAISE EXCEPTION 'رقم الهاتف مستعمل من طرف وكالة أخرى.';
    END IF;

    UPDATE public.agencies
    SET
        name = TRIM(p_name),
        phone = TRIM(p_phone),
        city = TRIM(p_city),
        latitude = COALESCE(p_lat, latitude),
        longitude = COALESCE(p_lng, longitude)
    WHERE public.agencies.id = v_agency.id
    RETURNING * INTO v_updated;

    UPDATE public.agency_cars
    SET
        city = v_updated.city,
        latitude = v_updated.latitude,
        longitude = v_updated.longitude
    WHERE agency_id = v_updated.id;

    RETURN QUERY SELECT
        v_updated.id,
        v_updated.name,
        v_updated.phone,
        v_updated.city,
        v_updated.latitude,
        v_updated.longitude,
        v_updated.verification_status,
        v_updated.rating_avg,
        v_updated.rating_count,
        v_updated.terms_accepted_at;
END;
$$;

-- (ي-2) تغيير الرمز السري (PIN) من داخل حساب الوكالة
CREATE OR REPLACE FUNCTION public.agency_change_pin(
    p_agency_id UUID,
    p_current_pin TEXT,
    p_new_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_clean_new TEXT := TRIM(COALESCE(p_new_pin, ''));
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_current_pin);

    IF LENGTH(v_clean_new) < 4 THEN
        RAISE EXCEPTION 'الرمز السري الجديد يجب أن يتكون من 4 أرقام أو رموز على الأقل.';
    END IF;

    IF v_clean_new = TRIM(COALESCE(p_current_pin, '')) THEN
        RAISE EXCEPTION 'الرمز السري الجديد يجب أن يكون مختلفاً عن الرمز الحالي.';
    END IF;

    UPDATE public.agencies
    SET pin_hash = extensions.crypt(v_clean_new, extensions.gen_salt('bf'))
    WHERE id = v_agency.id;

    RETURN true;
END;
$$;

-- (ك) حذف الوكالة وأسطولها نهائياً من قاعدة البيانات السحابية
CREATE OR REPLACE FUNCTION public.agency_delete_account(
    p_agency_id UUID,
    p_pin TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF EXISTS (
        SELECT 1 FROM public.bookings
        WHERE agency_id = v_agency.id
          AND status IN ('payment_uploaded', 'payment_verified', 'car_delivered', 'refund_requested')
    ) THEN
        RAISE EXCEPTION 'لا يمكن حذف الوكالة حالياً لوجود حجوزات نشطة قيد التنفيذ أو المراجعة.';
    END IF;

    DELETE FROM public.agencies WHERE id = v_agency.id;
    RETURN true;
END;
$$;

-- (ل) جلب حجوزات الوكالة (بوابة مزدوجة: مقنّع قبل الدفع، ومكشوف بعد التأكيد) + تأكيد التسليم بالرمز السري
DROP FUNCTION IF EXISTS public.agency_get_bookings(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.agency_get_bookings(
    p_agency_id UUID,
    p_pin TEXT
)
RETURNS TABLE (
    id UUID,
    booking_code TEXT,
    customer_name TEXT,
    customer_cin TEXT,
    customer_phone TEXT,
    customer_license_number TEXT,
    customer_license_issue_date DATE,
    pickup_location TEXT,
    days INTEGER,
    daily_price NUMERIC,
    total_amount NUMERIC,
    commission_amount NUMERIC,
    agency_payout_amount NUMERIC,
    delivery_at TIMESTAMPTZ,
    status TEXT,
    selected_bank_code TEXT,
    receipt_url TEXT,
    created_at TIMESTAMPTZ,
    car_brand TEXT,
    car_model TEXT,
    car_image TEXT,
    agency_ack_status TEXT,
    agency_ack_at TIMESTAMPTZ,
    agency_ack_note TEXT,
    reassigned_at TIMESTAMPTZ,
    dispute_flag TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    RETURN QUERY
    SELECT
        b.id,
        b.booking_code,
        CASE
            WHEN b.status NOT IN ('payment_verified', 'car_delivered', 'completed') THEN 'عميل قيد المعالجة'
            ELSE b.customer_name
        END AS customer_name,
        CASE
            WHEN b.status NOT IN ('payment_verified', 'car_delivered', 'completed') THEN '••••••••'
            ELSE b.customer_cin
        END AS customer_cin,
        CASE
            WHEN b.status NOT IN ('payment_verified', 'car_delivered', 'completed') THEN 'محجوب لحماية الخصوصية'
            ELSE b.customer_phone
        END AS customer_phone,
        CASE
            WHEN b.status NOT IN ('payment_verified', 'car_delivered', 'completed') THEN NULL::TEXT
            ELSE b.customer_license_number
        END AS customer_license_number,
        CASE
            WHEN b.status NOT IN ('payment_verified', 'car_delivered', 'completed') THEN NULL::DATE
            ELSE b.customer_license_issue_date
        END AS customer_license_issue_date,
        CASE
            WHEN b.status NOT IN ('payment_verified', 'car_delivered', 'completed') THEN COALESCE(c.city, v_agency.city)
            ELSE b.pickup_location
        END AS pickup_location,
        b.days,
        b.daily_price,
        b.total_amount,
        b.commission_amount,
        b.agency_payout_amount,
        b.delivery_at,
        b.status,
        b.selected_bank_code,
        NULL::TEXT AS receipt_url,
        b.created_at,
        c.brand AS car_brand,
        c.model AS car_model,
        c.primary_image_url AS car_image,
        b.agency_ack_status,
        b.agency_ack_at,
        b.agency_ack_note,
        b.reassigned_at,
        b.dispute_flag
    FROM public.bookings b
    LEFT JOIN public.agency_cars c ON c.id = b.agency_car_id
    WHERE b.agency_id = v_agency.id
      AND b.status IN ('payment_uploaded', 'payment_verified', 'car_delivered', 'completed', 'refund_requested', 'refunded')
    ORDER BY
        CASE WHEN b.status = 'payment_uploaded' THEN 0 WHEN b.status = 'payment_verified' THEN 1 ELSE 2 END,
        b.created_at DESC;
END;
$$;

-- تأكيد التوفر المسبق أو الاعتذار من طرف الوكالة (بدون كشف بيانات العميل)
CREATE OR REPLACE FUNCTION public.agency_respond_precheck(
    p_agency_id UUID,
    p_pin TEXT,
    p_booking_id UUID,
    p_ack_status TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_booking RECORD;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF p_ack_status NOT IN ('available', 'unavailable') THEN
        RAISE EXCEPTION 'حالة الاستجابة غير صالحة.';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND agency_id = v_agency.id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الحجز غير موجود.';
    END IF;

    IF v_booking.status NOT IN ('payment_uploaded', 'payment_verified') THEN
        RAISE EXCEPTION 'لا يمكن تعديل التوفر في هذه المرحلة.';
    END IF;

    UPDATE public.bookings
    SET
        agency_ack_status = p_ack_status,
        agency_ack_at = NOW(),
        agency_ack_note = NULLIF(TRIM(COALESCE(p_note, '')), ''),
        updated_at = NOW()
    WHERE id = p_booking_id;

    IF p_ack_status = 'unavailable' AND v_booking.agency_ack_status <> 'unavailable' THEN
        UPDATE public.agencies
        SET
            strike_count = COALESCE(strike_count, 0) + 1,
            last_strike_at = NOW()
        WHERE id = v_agency.id;
    END IF;

    RETURN true;
END;
$$;

-- التبليغ عن مخالفة من العميل عند التسليم (رخصة أقل من سنتين أو تغيب العميل) لحماية الوكالة
CREATE OR REPLACE FUNCTION public.agency_report_customer_issue(
    p_agency_id UUID,
    p_pin TEXT,
    p_booking_id UUID,
    p_issue_type TEXT,
    p_note TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_booking RECORD;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    IF p_issue_type NOT IN ('invalid_license', 'customer_no_show') THEN
        RAISE EXCEPTION 'نوع التبليغ غير صالح.';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND agency_id = v_agency.id;

    IF NOT FOUND OR v_booking.status <> 'payment_verified' THEN
        RAISE EXCEPTION 'يمكن التبليغ فقط على الحجوزات المؤكدة قبل التسليم.';
    END IF;

    UPDATE public.bookings
    SET
        dispute_flag = p_issue_type,
        agency_ack_note = COALESCE(NULLIF(TRIM(COALESCE(p_note, '')), ''), agency_ack_note),
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.agency_confirm_car_delivery(UUID, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.agency_confirm_car_delivery(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION public.agency_confirm_car_delivery(
    p_agency_id UUID,
    p_pin TEXT,
    p_booking_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_agency public.agencies;
    v_booking RECORD;
BEGIN
    v_agency := public.verify_agency_credentials(p_agency_id, p_pin);

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND agency_id = v_agency.id;

    IF NOT FOUND OR v_booking.status <> 'payment_verified' THEN
        RAISE EXCEPTION 'لا يمكن تأكيد التسليم قبل تأكيد دفع التسبيق من الإدارة.';
    END IF;

    UPDATE public.bookings
    SET status = 'car_delivered',
        delivered_at = NOW(),
        agency_confirmed_handover = true,
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN v_booking.id;
END;
$$;

-- (م) دوال الإدارة الموحدة (تعمل بـ PIN الإدارة أو حساب Supabase Admin)
CREATE OR REPLACE FUNCTION public.admin_get_dashboard_data(p_admin_pin TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_bookings JSONB;
    v_payouts JSONB;
    v_agencies JSONB;
    v_catalog JSONB;
    v_available_cars JSONB;
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بالوصول لبيانات الإدارة.';
    END IF;

    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::JSONB) INTO v_bookings
    FROM (
        SELECT
            b.*,
            a.name AS agency_name,
            a.phone AS agency_phone,
            c.brand AS car_brand,
            c.model AS car_model,
            COALESCE(c.city, a.city) AS car_city
        FROM public.bookings b
        LEFT JOIN public.agencies a ON a.id = b.agency_id
        LEFT JOIN public.agency_cars c ON c.id = b.agency_car_id
        ORDER BY b.created_at DESC
    ) t;

    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::JSONB) INTO v_payouts
    FROM (
        SELECT * FROM public.payouts ORDER BY created_at DESC
    ) p;

    SELECT COALESCE(jsonb_agg(row_to_json(ag)), '[]'::JSONB) INTO v_agencies
    FROM (
        SELECT
            id, name, phone, city, verification_status, rating_avg, rating_count,
            terms_accepted_at, COALESCE(strike_count, 0) AS strike_count, last_strike_at, created_at
        FROM public.agencies
        ORDER BY created_at DESC
    ) ag;

    SELECT COALESCE(jsonb_agg(row_to_json(cat)), '[]'::JSONB) INTO v_catalog
    FROM (
        SELECT * FROM public.car_catalog ORDER BY brand ASC, model ASC
    ) cat;

    SELECT COALESCE(jsonb_agg(row_to_json(ac)), '[]'::JSONB) INTO v_available_cars
    FROM (
        SELECT
            c.id AS car_id,
            c.agency_id,
            a.name AS agency_name,
            a.phone AS agency_phone,
            c.brand,
            c.model,
            c.city,
            c.daily_price
        FROM public.agency_cars c
        JOIN public.agencies a ON a.id = c.agency_id
        WHERE c.status = 'available'
          AND a.verification_status = 'verified'
        ORDER BY c.city ASC, c.daily_price ASC
    ) ac;

    RETURN jsonb_build_object(
        'bookings', v_bookings,
        'payouts', v_payouts,
        'agencies', v_agencies,
        'catalog', v_catalog,
        'available_cars', v_available_cars
    );
END;
$$;

DROP FUNCTION IF EXISTS public.admin_verify_payment(UUID);
CREATE OR REPLACE FUNCTION public.admin_verify_payment(
    p_booking_id UUID,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
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

CREATE OR REPLACE FUNCTION public.admin_verify_agency(
    p_agency_id UUID,
    p_status TEXT,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    IF p_status NOT IN ('pending', 'verified', 'suspended') THEN
        RAISE EXCEPTION 'حالة التوثيق غير صالحة';
    END IF;

    UPDATE public.agencies
    SET verification_status = p_status
    WHERE id = p_agency_id;

    RETURN FOUND;
END;
$$;

-- آلية الإنقاذ وإعادة التوجيه: تحويل الحجز لوكالة أخرى موثقة في حال اعتذار أو تقاعس الوكالة الأولى
CREATE OR REPLACE FUNCTION public.admin_reassign_booking(
    p_booking_id UUID,
    p_target_car_id UUID,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_booking RECORD;
    v_target_car RECORD;
    v_end_at TIMESTAMPTZ;
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الحجز غير موجود.';
    END IF;

    IF v_booking.status NOT IN ('payment_uploaded', 'payment_verified', 'refund_requested') THEN
        RAISE EXCEPTION 'لا يمكن تحويل الحجز في هذه المرحلة.';
    END IF;

    SELECT c.*, a.verification_status, a.name AS target_agency_name
    INTO v_target_car
    FROM public.agency_cars c
    JOIN public.agencies a ON a.id = c.agency_id
    WHERE c.id = p_target_car_id;

    IF NOT FOUND OR v_target_car.status <> 'available' OR v_target_car.verification_status <> 'verified' THEN
        RAISE EXCEPTION 'السيارة أو الوكالة البديلة غير متاحة أو غير موثقة.';
    END IF;

    IF v_target_car.agency_id = v_booking.agency_id THEN
        RAISE EXCEPTION 'السيارة المختارة تابعة لنفس الوكالة الحالية.';
    END IF;

    v_end_at := v_booking.delivery_at + (v_booking.days * INTERVAL '1 day');
    IF EXISTS (
        SELECT 1
        FROM public.bookings b
        WHERE b.agency_car_id = v_target_car.id
          AND b.id <> v_booking.id
          AND b.status IN ('payment_uploaded', 'payment_verified', 'car_delivered')
          AND b.delivery_at < v_end_at
          AND (b.delivery_at + (b.days * INTERVAL '1 day')) > v_booking.delivery_at
    ) THEN
        RAISE EXCEPTION 'السيارة البديلة محجوزة في نفس التواريخ.';
    END IF;

    -- تسجيل مخالفة على الوكالة السابقة إذا لم تُسجل مسبقاً بسبب عدم التوفر
    IF v_booking.agency_id IS NOT NULL AND v_booking.agency_ack_status <> 'unavailable' THEN
        UPDATE public.agencies
        SET
            strike_count = COALESCE(strike_count, 0) + 1,
            last_strike_at = NOW()
        WHERE id = v_booking.agency_id;
    END IF;

    UPDATE public.bookings
    SET
        reassigned_from_agency_id = COALESCE(reassigned_from_agency_id, agency_id),
        reassigned_at = NOW(),
        agency_id = v_target_car.agency_id,
        agency_car_id = v_target_car.id,
        agency_ack_status = 'pending',
        agency_ack_at = NULL,
        agency_ack_note = 'تم تحويل الحجز إليكم من الإدارة لتلبية طلب العميل.',
        dispute_flag = NULL,
        refund_allowed_by_admin = false,
        status = CASE WHEN status = 'refund_requested' THEN 'payment_verified' ELSE status END,
        updated_at = NOW()
    WHERE id = p_booking_id;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_allow_refund(
    p_booking_id UUID,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    UPDATE public.bookings
    SET refund_allowed_by_admin = true,
        updated_at = NOW()
    WHERE id = p_booking_id
      AND status IN ('payment_uploaded', 'payment_verified');

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الحجز غير موجود أو لا يقبل فتح الاسترجاع في هذه المرحلة.';
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_agency_pin(
    p_agency_id UUID,
    p_new_pin TEXT,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_clean_pin TEXT := TRIM(COALESCE(p_new_pin, ''));
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    IF LENGTH(v_clean_pin) < 4 THEN
        RAISE EXCEPTION 'الرمز السري المؤقت يجب أن يتكون من 4 أرقام أو رموز على الأقل.';
    END IF;

    UPDATE public.agencies
    SET pin_hash = extensions.crypt(v_clean_pin, extensions.gen_salt('bf'))
    WHERE id = p_agency_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الوكالة غير موجودة.';
    END IF;

    RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_payout_sent(
    p_payout_id UUID,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بهذه العملية';
    END IF;

    UPDATE public.payouts
    SET status = 'sent', sent_at = NOW()
    WHERE id = p_payout_id;

    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_catalog_car(
    p_brand TEXT,
    p_model TEXT,
    p_category TEXT DEFAULT 'Économique',
    p_seats INTEGER DEFAULT 5,
    p_default_fuel TEXT DEFAULT 'diesel',
    p_default_transmission TEXT DEFAULT 'manual',
    p_image_url TEXT DEFAULT NULL,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS public.car_catalog
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_row public.car_catalog;
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بتعديل الكتالوج المركزي.';
    END IF;

    INSERT INTO public.car_catalog (
        brand, model, category, seats, default_fuel, default_transmission, image_url
    ) VALUES (
        TRIM(p_brand),
        TRIM(p_model),
        COALESCE(NULLIF(TRIM(p_category), ''), 'Économique'),
        COALESCE(p_seats, 5),
        COALESCE(NULLIF(TRIM(p_default_fuel), ''), 'diesel'),
        COALESCE(NULLIF(TRIM(p_default_transmission), ''), 'manual'),
        NULLIF(TRIM(COALESCE(p_image_url, '')), '')
    )
    ON CONFLICT (LOWER(TRIM(brand)), LOWER(TRIM(model)))
    DO UPDATE SET
        category = EXCLUDED.category,
        seats = EXCLUDED.seats,
        default_fuel = EXCLUDED.default_fuel,
        default_transmission = EXCLUDED.default_transmission,
        image_url = COALESCE(EXCLUDED.image_url, public.car_catalog.image_url)
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_catalog_car(
    p_catalog_id UUID,
    p_admin_pin TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    IF NOT public.is_admin_or_pin(p_admin_pin) THEN
        RAISE EXCEPTION 'غير مصرح لك بحذف موديل من الكتالوج.';
    END IF;

    DELETE FROM public.car_catalog WHERE id = p_catalog_id;
    RETURN FOUND;
END;
$$;

-- (ن) تأكيد تسليم السيارة بالمعرف التقليدي وطلب الاسترجاع 100% وتتبع العميل
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
        RAISE EXCEPTION 'لا يمكن تأكيد التسليم قبل تأكيد دفع التسبيق';
    END IF;

    SELECT * INTO v_agency FROM public.agencies WHERE id = v_booking.agency_id;

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

DROP FUNCTION IF EXISTS public.request_full_refund(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.request_full_refund(UUID, TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.request_full_refund(
    p_booking_id UUID,
    p_booking_code TEXT,
    p_customer_rib TEXT,
    p_reason TEXT,
    p_customer_phone TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_booking RECORD;
    v_payout_id UUID;
    v_norm_input_phone TEXT := REGEXP_REPLACE(COALESCE(p_customer_phone, ''), '[^0-9]', '', 'g');
    v_norm_db_phone TEXT;
    v_is_refund_eligible BOOLEAN := false;
BEGIN
    SELECT * INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id AND UPPER(TRIM(booking_code)) = UPPER(TRIM(p_booking_code));

    IF NOT FOUND THEN
        RAISE EXCEPTION 'بيانات الحجز غير صحيحة';
    END IF;

    v_norm_db_phone := REGEXP_REPLACE(COALESCE(v_booking.customer_phone, ''), '[^0-9]', '', 'g');
    IF LENGTH(v_norm_input_phone) >= 6 AND v_norm_input_phone <> v_norm_db_phone THEN
        RAISE EXCEPTION 'رقم الهاتف المدخل غير مطابق لرقم العميل المسجل في الحجز.';
    END IF;

    IF v_booking.status NOT IN ('payment_uploaded', 'payment_verified') THEN
        RAISE EXCEPTION 'لا يمكن طلب الاسترجاع في هذه الحالة';
    END IF;

    IF v_booking.dispute_flag IS NOT NULL THEN
        RAISE EXCEPTION 'تم تسجيل مخالفة على الحجز من طرف الوكالة (عدم تطابق الرخصة أو عدم الحضور)، ولا يحق استرجاع التسبيق تلقائياً.';
    END IF;

    v_is_refund_eligible :=
        v_booking.agency_ack_status = 'unavailable'
        OR COALESCE(v_booking.refund_allowed_by_admin, false) = true
        OR (v_booking.status = 'payment_verified' AND NOW() > v_booking.delivery_at);

    IF NOT v_is_refund_eligible THEN
        RAISE EXCEPTION 'لا يمكن طلب استرجاع التسبيق ما دامت الوكالة ملتزمة بتوفير السيارة في الموعد المحدد. يُفتح الاسترجاع فقط إذا أعلنت الوكالة عدم توفر السيارة، أو تعذر التسليم بعد الموعد المحدد، أو بقرار من الإدارة.';
    END IF;

    UPDATE public.bookings
    SET status = 'refund_requested',
        customer_refund_rib = TRIM(p_customer_rib),
        refund_reason = p_reason,
        updated_at = NOW()
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
        'استرجاع كامل مبلغ التسبيق (10%) للعميل لعدم تسليم السيارة: ' || COALESCE(p_reason, '')
    )
    RETURNING id INTO v_payout_id;

    RETURN v_payout_id;
END;
$$;

DROP FUNCTION IF EXISTS public.cancel_pending_booking(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.cancel_pending_booking(
    p_booking_id UUID,
    p_booking_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.bookings
    SET status = 'cancelled',
        updated_at = NOW()
    WHERE id = p_booking_id
      AND UPPER(TRIM(booking_code)) = UPPER(TRIM(p_booking_code))
      AND status = 'pending_payment';

    RETURN FOUND;
END;
$$;

DROP FUNCTION IF EXISTS public.get_customer_booking_by_phone(TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.get_customer_booking_by_phone(
    p_booking_code TEXT,
    p_customer_phone TEXT
)
RETURNS TABLE (
    booking_id UUID,
    booking_code TEXT,
    car_label TEXT,
    car_image TEXT,
    agency_name TEXT,
    city TEXT,
    days INTEGER,
    total_amount NUMERIC,
    commission_amount NUMERIC,
    agency_payout_amount NUMERIC,
    delivery_at TIMESTAMPTZ,
    status TEXT,
    agency_ack_status TEXT,
    dispute_flag TEXT,
    refund_allowed_by_admin BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        b.id AS booking_id,
        b.booking_code,
        COALESCE(c.brand || ' ' || c.model, 'سيارة اقتصادية') AS car_label,
        COALESCE(c.primary_image_url, '') AS car_image,
        COALESCE(a.name, 'وكالة معتمدة') AS agency_name,
        COALESCE(c.city, a.city, 'Casablanca') AS city,
        b.days,
        b.total_amount,
        b.commission_amount,
        b.agency_payout_amount,
        b.delivery_at,
        b.status,
        b.agency_ack_status,
        b.dispute_flag,
        COALESCE(b.refund_allowed_by_admin, false) AS refund_allowed_by_admin
    FROM public.bookings b
    LEFT JOIN public.agency_cars c ON c.id = b.agency_car_id
    LEFT JOIN public.agencies a ON a.id = b.agency_id
    WHERE UPPER(TRIM(b.booking_code)) = UPPER(TRIM(p_booking_code))
      AND REGEXP_REPLACE(b.customer_phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(p_customer_phone, '[^0-9]', '', 'g');
$$;

-- منح صلاحيات الاستدعاء
GRANT EXECUTE ON FUNCTION public.get_nearby_cars(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TIMESTAMPTZ, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking(UUID, TEXT, TEXT, TEXT, INTEGER, TIMESTAMPTZ, UUID, TEXT, TEXT, TEXT, DATE, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_booking(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_payment_receipt(UUID, TEXT, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_full_refund(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_booking_by_phone(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_admin_pin(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_agency_by_phone(TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_agency_by_phone(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_get_cars(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_add_catalog_car(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, INTEGER, INTEGER, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_update_car(UUID, TEXT, UUID, NUMERIC, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_delete_car(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_change_pin(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_delete_account(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_get_bookings(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_respond_precheck(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_report_customer_issue(UUID, TEXT, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agency_confirm_car_delivery(UUID, TEXT, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_dashboard_data(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_payment(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_verify_agency(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reassign_booking(UUID, UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_allow_refund(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_agency_pin(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_payout_sent(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_catalog_car(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_catalog_car(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_car_delivery(UUID) TO authenticated;

-- ============================================================================
-- 12. SUPABASE STORAGE BUCKETS (صور الكتالوج + وصولات التحويل البنكي)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('car-photos', 'car-photos', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('payment-receipts', 'payment-receipts', true, 5242880, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "car_photos_public_read" ON storage.objects;
CREATE POLICY "car_photos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'car-photos');

DROP POLICY IF EXISTS "car_photos_agency_upload" ON storage.objects;
CREATE POLICY "car_photos_agency_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'car-photos');

DROP POLICY IF EXISTS "car_photos_agency_delete" ON storage.objects;
CREATE POLICY "car_photos_agency_delete"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'car-photos');

DROP POLICY IF EXISTS "receipts_anyone_upload" ON storage.objects;
CREATE POLICY "receipts_anyone_upload"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "receipts_admin_read" ON storage.objects;
CREATE POLICY "receipts_admin_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'payment-receipts');
