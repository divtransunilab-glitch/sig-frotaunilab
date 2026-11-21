-- ============================================================================
-- SIG-FROTA UNILAB — Migração de Colunas, Segurança RLS e Tempo Real (Realtime)
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Persistir Paradas Intermediárias e KM Extra na tabela trip_requests
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS intermediate_cities text[],
  ADD COLUMN IF NOT EXISTS extra_km numeric(10, 2);

-- 2. Habilitar Supabase Realtime na tabela trip_requests (atualização entre operadores)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'trip_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_requests;
  END IF;
END $$;

-- 3. Políticas de Segurança RLS (Row Level Security)
-- Leitura pública controlada (necessária para o Portal do Solicitante / Transparência)
-- Escrita (INSERT / UPDATE / DELETE) restrita EXCLUSIVAMENTE a usuários autenticados no Supabase Auth

-- 3.1 trip_requests
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read trip_requests" ON public.trip_requests;
DROP POLICY IF EXISTS "Authenticated write trip_requests" ON public.trip_requests;
DROP POLICY IF EXISTS "Allow all trip_requests" ON public.trip_requests;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.trip_requests;

CREATE POLICY "Public read trip_requests"
  ON public.trip_requests
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated insert trip_requests"
  ON public.trip_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated update trip_requests"
  ON public.trip_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated delete trip_requests"
  ON public.trip_requests
  FOR DELETE
  TO authenticated
  USING (true);

-- 3.2 audit_logs (somente usuários autenticados podem ler e inserir; ninguém apaga auditoria via cliente)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Allow all audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.audit_logs;

CREATE POLICY "Authenticated read audit_logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert audit_logs"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3.3 Tabelas de referência (cities, distance_matrix, vehicles, drivers, contractors)
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['cities', 'distance_matrix', 'vehicles', 'drivers', 'contractors']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users" ON public.%I;', tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Public read %I" ON public.%I;', tbl, tbl);
      EXECUTE format('DROP POLICY IF EXISTS "Authenticated write %I" ON public.%I;', tbl, tbl);
      EXECUTE format('CREATE POLICY "Public read %I" ON public.%I FOR SELECT TO anon, authenticated USING (true);', tbl, tbl);
      EXECUTE format('CREATE POLICY "Authenticated write %I" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true);', tbl, tbl);
    END IF;
  END LOOP;
END $$;
