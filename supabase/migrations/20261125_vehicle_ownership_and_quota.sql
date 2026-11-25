-- ============================================================================
-- SIG-FROTA UNILAB — Tipo de Frota (Própria vs Contratada) e Dados de Franquia
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS ownership_type text,
  ADD COLUMN IF NOT EXISTS monthly_km_quota numeric,
  ADD COLUMN IF NOT EXISTS excess_km_cost numeric,
  ADD COLUMN IF NOT EXISTS monthly_fixed_cost numeric;
