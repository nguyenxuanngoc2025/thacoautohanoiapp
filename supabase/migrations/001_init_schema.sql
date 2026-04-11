-- ============================================
-- THACO MKT Budget — Database Schema
-- Prefix: thac_
-- ============================================

-- 1. Organizations (multi-tenant ready)
CREATE TABLE IF NOT EXISTS thac_organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Showrooms
CREATE TABLE IF NOT EXISTS thac_showrooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES thac_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, code)
);

-- 3. Brands
CREATE TABLE IF NOT EXISTS thac_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES thac_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(org_id, code)
);

-- 4. Vehicle Models
CREATE TABLE IF NOT EXISTS thac_vehicle_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES thac_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sub_group TEXT, -- e.g. "Nhóm doanh số chính" for BMW
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 5. Showroom ↔ Brand mapping (M:N)
CREATE TABLE IF NOT EXISTS thac_showroom_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  showroom_id UUID NOT NULL REFERENCES thac_showrooms(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES thac_brands(id) ON DELETE CASCADE,
  UNIQUE(showroom_id, brand_id)
);

-- 6. Marketing Channels
CREATE TABLE IF NOT EXISTS thac_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES thac_organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('DIGITAL', 'SỰ KIỆN', 'CSKH', 'NHẬN DIỆN')),
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(org_id, name)
);

-- 7. Users (extends auth.users)
CREATE TABLE IF NOT EXISTS thac_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES thac_organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('bld', 'gd_showroom', 'mkt_brand', 'mkt_showroom', 'finance')),
  showroom_id UUID REFERENCES thac_showrooms(id) ON DELETE SET NULL,
  brand_id UUID REFERENCES thac_brands(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Budget Entries (CORE TABLE)
CREATE TABLE IF NOT EXISTS thac_budget_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES thac_organizations(id) ON DELETE CASCADE,
  showroom_id UUID NOT NULL REFERENCES thac_showrooms(id) ON DELETE CASCADE,
  brand_id UUID NOT NULL REFERENCES thac_brands(id) ON DELETE CASCADE,
  vehicle_model_id UUID REFERENCES thac_vehicle_models(id) ON DELETE SET NULL,
  channel_id UUID NOT NULL REFERENCES thac_channels(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  week INT CHECK (week IS NULL OR week BETWEEN 1 AND 6),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('plan', 'actual')),
  budget_amount DECIMAL(15,2) DEFAULT 0,
  khqt INT DEFAULT 0,
  gdtd INT DEFAULT 0,
  khd INT DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES thac_users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES thac_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(showroom_id, brand_id, vehicle_model_id, channel_id, year, month, week, entry_type)
);

-- 9. Approvals
CREATE TABLE IF NOT EXISTS thac_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES thac_organizations(id) ON DELETE CASCADE,
  showroom_id UUID NOT NULL REFERENCES thac_showrooms(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES thac_brands(id) ON DELETE SET NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_gd', 'pending_bld', 'approved', 'rejected')),
  submitted_by UUID REFERENCES thac_users(id),
  submitted_at TIMESTAMPTZ,
  gd_approved_by UUID REFERENCES thac_users(id),
  gd_approved_at TIMESTAMPTZ,
  gd_comment TEXT,
  bld_approved_by UUID REFERENCES thac_users(id),
  bld_approved_at TIMESTAMPTZ,
  bld_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_budget_entries_lookup 
  ON thac_budget_entries(org_id, showroom_id, brand_id, year, month, entry_type);

CREATE INDEX IF NOT EXISTS idx_budget_entries_period 
  ON thac_budget_entries(year, month, week);

CREATE INDEX IF NOT EXISTS idx_budget_entries_type 
  ON thac_budget_entries(entry_type);

CREATE INDEX IF NOT EXISTS idx_approvals_lookup 
  ON thac_approvals(org_id, showroom_id, year, month);

-- ============================================
-- AUTO-UPDATE updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION thac_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER thac_budget_entries_updated_at
  BEFORE UPDATE ON thac_budget_entries
  FOR EACH ROW EXECUTE FUNCTION thac_update_updated_at();

-- ============================================
-- KPI VIEW (computed metrics)
-- ============================================
CREATE OR REPLACE VIEW thac_kpi_view AS
SELECT 
  be.*,
  CASE WHEN be.khqt > 0 THEN ROUND(be.gdtd::numeric / be.khqt * 100, 1) END AS tlcd_khqt_gdtd,
  CASE WHEN be.gdtd > 0 THEN ROUND(be.khd::numeric / be.gdtd * 100, 1) END AS tlcd_gdtd_khd,
  CASE WHEN be.khqt > 0 THEN ROUND(be.khd::numeric / be.khqt * 100, 1) END AS tlcd_khqt_khd,
  CASE WHEN be.khqt > 0 THEN ROUND(be.budget_amount / be.khqt, 0) END AS cost_per_lead,
  CASE WHEN be.khd > 0 THEN ROUND(be.budget_amount / be.khd, 0) END AS cost_per_acquisition,
  s.name AS showroom_name,
  b.name AS brand_name,
  vm.name AS vehicle_model_name,
  ch.name AS channel_name,
  ch.category AS channel_category
FROM thac_budget_entries be
LEFT JOIN thac_showrooms s ON be.showroom_id = s.id
LEFT JOIN thac_brands b ON be.brand_id = b.id
LEFT JOIN thac_vehicle_models vm ON be.vehicle_model_id = vm.id
LEFT JOIN thac_channels ch ON be.channel_id = ch.id;
