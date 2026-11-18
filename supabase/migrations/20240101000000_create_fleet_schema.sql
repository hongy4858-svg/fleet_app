-- ==============================================================================
-- 기업 차량 운영 관리 및 친환경차 전환 경제성 분석 시스템 (Fleet Management)
-- Supabase PostgreSQL 스키마 및 RLS(Row Level Security) 마이그레이션
-- ==============================================================================

-- 1. UUID 확장 기능 활성화 (필요 시)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. 테이블 생성 (기존 TypeScript 도메인 모델과 1:1 일치)
-- ------------------------------------------------------------------------------

-- (1) 차량 마스터 (vehicles)
CREATE TABLE IF NOT EXISTS public.vehicles (
    id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    model_name TEXT NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('gasoline', 'diesel', 'hybrid', 'electric', 'hydrogen')),
    purchase_date DATE NOT NULL,
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0),
    official_efficiency NUMERIC NOT NULL CHECK (official_efficiency > 0),
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 복합 외래키 연결 및 사용자별 차량번호 중복 방지 제약
    CONSTRAINT uq_vehicles_id_owner UNIQUE (id, owner_id),
    CONSTRAINT uq_vehicles_owner_plate UNIQUE (owner_id, plate_number)
);

-- (2) 운행 기록 (trip_logs)
CREATE TABLE IF NOT EXISTS public.trip_logs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trip_date DATE NOT NULL,
    distance_km NUMERIC NOT NULL CHECK (distance_km > 0),
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- 타 사용자의 차량과 연결을 DB 레벨에서 원천 차단하는 복합 외래키
    CONSTRAINT fk_trips_vehicle_owner FOREIGN KEY (vehicle_id, owner_id)
        REFERENCES public.vehicles(id, owner_id) ON DELETE CASCADE
);

-- (3) 주유·충전 기록 (energy_logs)
CREATE TABLE IF NOT EXISTS public.energy_logs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    total_cost NUMERIC NOT NULL CHECK (total_cost >= 0),
    unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_energy_vehicle_owner FOREIGN KEY (vehicle_id, owner_id)
        REFERENCES public.vehicles(id, owner_id) ON DELETE CASCADE
);

-- (4) 정비 기록 (maintenance_logs)
CREATE TABLE IF NOT EXISTS public.maintenance_logs (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    maintenance_date DATE NOT NULL,
    item_name TEXT NOT NULL,
    cost NUMERIC NOT NULL CHECK (cost >= 0),
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_maintenance_vehicle_owner FOREIGN KEY (vehicle_id, owner_id)
        REFERENCES public.vehicles(id, owner_id) ON DELETE CASCADE
);

-- (5) 친환경 교체 후보 차량 (replacement_candidates)
CREATE TABLE IF NOT EXISTS public.replacement_candidates (
    id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('gasoline', 'diesel', 'hybrid', 'electric', 'hydrogen')),
    purchase_price NUMERIC NOT NULL CHECK (purchase_price >= 0),
    subsidy NUMERIC NOT NULL DEFAULT 0 CHECK (subsidy >= 0),
    incidental_cost NUMERIC NOT NULL DEFAULT 0 CHECK (incidental_cost >= 0),
    efficiency NUMERIC NOT NULL CHECK (efficiency > 0),
    energy_price NUMERIC NOT NULL CHECK (energy_price >= 0),
    annual_maintenance NUMERIC NOT NULL DEFAULT 0 CHECK (annual_maintenance >= 0),
    annual_tax NUMERIC NOT NULL DEFAULT 0 CHECK (annual_tax >= 0),
    annual_insurance NUMERIC NOT NULL DEFAULT 0 CHECK (annual_insurance >= 0),
    expected_salvage NUMERIC NOT NULL DEFAULT 0 CHECK (expected_salvage >= 0),
    memo TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- (6) 경제성 분석 이력 (analyses) - 불변 스냅샷 영구 보존
CREATE TABLE IF NOT EXISTS public.analyses (
    id TEXT PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    existing_vehicle_id TEXT,
    replacement_candidate_id TEXT,
    input_snapshot JSONB NOT NULL,
    result_snapshot JSONB NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. 성능 인덱스 생성
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vehicles_owner ON public.vehicles (owner_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_vehicle ON public.trip_logs (vehicle_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_trip_logs_date ON public.trip_logs (trip_date);
CREATE INDEX IF NOT EXISTS idx_energy_logs_vehicle ON public.energy_logs (vehicle_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_energy_logs_date ON public.energy_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_logs_vehicle ON public.maintenance_logs (vehicle_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_replacement_candidates_owner ON public.replacement_candidates (owner_id);
CREATE INDEX IF NOT EXISTS idx_analyses_owner ON public.analyses (owner_id, created_at DESC);

-- ------------------------------------------------------------------------------
-- 4. RLS (Row Level Security) 활성화
-- ------------------------------------------------------------------------------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.energy_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacement_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. RLS 정책 정의 (로그인 사용자 본인 데이터만 CRUD 허용)
-- ------------------------------------------------------------------------------

-- (1) vehicles RLS
DROP POLICY IF EXISTS "Users can manage their own vehicles" ON public.vehicles;
CREATE POLICY "Users can manage their own vehicles"
    ON public.vehicles
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- (2) trip_logs RLS
DROP POLICY IF EXISTS "Users can manage their own trip logs" ON public.trip_logs;
CREATE POLICY "Users can manage their own trip logs"
    ON public.trip_logs
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- (3) energy_logs RLS
DROP POLICY IF EXISTS "Users can manage their own energy logs" ON public.energy_logs;
CREATE POLICY "Users can manage their own energy logs"
    ON public.energy_logs
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- (4) maintenance_logs RLS
DROP POLICY IF EXISTS "Users can manage their own maintenance logs" ON public.maintenance_logs;
CREATE POLICY "Users can manage their own maintenance logs"
    ON public.maintenance_logs
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- (5) replacement_candidates RLS
DROP POLICY IF EXISTS "Users can manage their own replacement candidates" ON public.replacement_candidates;
CREATE POLICY "Users can manage their own replacement candidates"
    ON public.replacement_candidates
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- (6) analyses RLS
DROP POLICY IF EXISTS "Users can manage their own analyses" ON public.analyses;
CREATE POLICY "Users can manage their own analyses"
    ON public.analyses
    FOR ALL
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

-- ------------------------------------------------------------------------------
-- 6. 최소 권한 원칙(Least Privilege)에 따른 테이블별 권한 제어
-- ------------------------------------------------------------------------------

-- (1) 6개 테이블에 대한 기존 기본 권한을 anon, authenticated로부터 모두 회수
REVOKE ALL ON TABLE 
    public.vehicles,
    public.trip_logs,
    public.energy_logs,
    public.maintenance_logs,
    public.replacement_candidates,
    public.analyses
FROM anon, authenticated;

-- (2) authenticated 사용자에게 public 스키마 접근(USAGE) 권한 부여
GRANT USAGE ON SCHEMA public TO authenticated;

-- (3) 일반 운영 관리 테이블: SELECT, INSERT, UPDATE, DELETE 권한 부여
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE 
    public.vehicles,
    public.trip_logs,
    public.energy_logs,
    public.maintenance_logs,
    public.replacement_candidates
TO authenticated;

-- (4) 경제성 분석 이력(analyses) 테이블: SELECT, INSERT, DELETE 권한만 부여
--     * UPDATE 권한을 명시적으로 배제하여 저장된 분석 스냅샷의 위변조 방지 및 불변성 보장
GRANT SELECT, INSERT, DELETE ON TABLE 
    public.analyses
TO authenticated;

