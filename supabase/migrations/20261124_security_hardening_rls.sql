-- ============================================================================
-- SIG-FROTA UNILAB — Blindagem de Segurança RLS, LGPD e RPCs Públicas Seguras
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. FECHAR LEITURA DIRETA DE TABELAS SENSÍVEIS PARA USUÁRIOS ANÔNIMOS (anon)
--    Impede que qualquer pessoa leia e-mails, telefones, CNH, PIN ou tokens via API REST.
ALTER TABLE public.trip_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read trip_requests" ON public.trip_requests;
DROP POLICY IF EXISTS "Authenticated read trip_requests" ON public.trip_requests;

CREATE POLICY "Authenticated read trip_requests"
  ON public.trip_requests
  FOR SELECT
  TO authenticated
  USING (true);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read drivers" ON public.drivers;
DROP POLICY IF EXISTS "Authenticated read drivers" ON public.drivers;

CREATE POLICY "Authenticated read drivers"
  ON public.drivers
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. RPC PÚBLICA SEGURA PARA O PAINEL DE TRANSPARÊNCIA (100% ANONIMIZADA — LGPD)
--    Não retorna e-mail, telefone, lista de passageiros, observações privadas nem driver_access_token.
CREATE OR REPLACE FUNCTION public.get_public_transparency_trips()
RETURNS TABLE (
  id text,
  process_number text,
  received_at timestamptz,
  advance_days integer,
  status_deadline text,
  activity_type text,
  macro_unit text,
  requesting_unit text,
  origin_city_id text,
  destination_city_id text,
  departure_datetime timestamptz,
  return_datetime timestamptz,
  passenger_count integer,
  status text,
  rejection_reason text,
  travel_report_status text,
  estimated_km numeric,
  real_km numeric,
  driver_checkin_at timestamptz,
  driver_checkout_at timestamptz,
  allocated_vehicle_id text,
  allocated_contractor_id text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.process_number,
    t.received_at,
    t.advance_days,
    t.status_deadline,
    t.activity_type,
    t.macro_unit,
    t.requesting_unit,
    t.origin_city_id,
    t.destination_city_id,
    t.departure_datetime,
    t.return_datetime,
    t.passenger_count,
    t.status,
    t.rejection_reason,
    t.travel_report_status,
    t.estimated_km,
    t.real_km,
    t.driver_checkin_at,
    t.driver_checkout_at,
    t.allocated_vehicle_id,
    t.allocated_contractor_id,
    t.created_at,
    t.updated_at
  FROM public.trip_requests t
  ORDER BY t.departure_datetime ASC;
$$;

REVOKE ALL ON FUNCTION public.get_public_transparency_trips() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_transparency_trips() TO anon, authenticated;

-- 3. RPC PÚBLICA SEGURA PARA CONSULTA DE PROCESSO NO PORTAL DO SOLICITANTE
--    Exige termo mínimo de 4 caracteres; nunca retorna driver_access_token, CNH, PIN ou telefones.
CREATE OR REPLACE FUNCTION public.search_public_trip(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := lower(trim(COALESCE(p_query, '')));
  v_result jsonb;
BEGIN
  IF length(v_q) < 4 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'process_number', t.process_number,
        'received_at', t.received_at,
        'advance_days', t.advance_days,
        'status_deadline', t.status_deadline,
        'activity_type', t.activity_type,
        'requester_name', t.requester_name,
        'macro_unit', t.macro_unit,
        'requesting_unit', t.requesting_unit,
        'origin_city_id', t.origin_city_id,
        'destination_city_id', t.destination_city_id,
        'departure_datetime', t.departure_datetime,
        'return_datetime', t.return_datetime,
        'passenger_count', t.passenger_count,
        'status', t.status,
        'rejection_reason', t.rejection_reason,
        'rejection_notes', t.rejection_notes,
        'travel_report_status', t.travel_report_status,
        'estimated_km', t.estimated_km,
        'real_km', t.real_km,
        'driver_checkin_at', t.driver_checkin_at,
        'driver_checkout_at', t.driver_checkout_at,
        'allocated_vehicle_id', t.allocated_vehicle_id,
        'allocated_contractor_id', t.allocated_contractor_id,
        'driver_public_name', d.name
      )
      ORDER BY t.departure_datetime DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.trip_requests t
  LEFT JOIN public.drivers d ON d.id = t.allocated_driver_id
  WHERE lower(t.process_number) LIKE '%' || v_q || '%'
     OR lower(COALESCE(t.requester_email, '')) = v_q
  LIMIT 20;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_trip(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_trip(text) TO anon, authenticated;

-- 4. RPC SEGURA PARA CARREGAR A ORDEM DIGITAL DO MOTORISTA (VALIDA TOKEN NO SERVIDOR)
--    Nunca expõe PIN, CNH ou telefone do motorista ao navegador.
CREATE OR REPLACE FUNCTION public.get_driver_order_public(
  p_trip_id text,
  p_access_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests;
  v_driver RECORD;
  v_vehicle public.vehicles;
  v_has_pin boolean := false;
  v_has_cnh boolean := false;
  v_has_phone boolean := false;
BEGIN
  SELECT * INTO v_trip
  FROM public.trip_requests
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- Verifica token único da viagem
  IF v_trip.driver_access_token IS NOT NULL AND trim(v_trip.driver_access_token) <> '' THEN
    IF p_access_token IS NULL OR trim(p_access_token) <> trim(v_trip.driver_access_token) THEN
      RETURN jsonb_build_object('status', 'invalid_token');
    END IF;
  END IF;

  IF v_trip.allocated_vehicle_id IS NOT NULL THEN
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = v_trip.allocated_vehicle_id;
  END IF;

  IF v_trip.allocated_driver_id IS NOT NULL THEN
    SELECT id, name, cnh_category, driver_category, access_pin, cnh_number, phone
      INTO v_driver
    FROM public.drivers
    WHERE id = v_trip.allocated_driver_id;

    IF FOUND THEN
      v_has_pin := length(regexp_replace(COALESCE(v_driver.access_pin, ''), '\D', '', 'g')) >= 4;
      v_has_cnh := length(regexp_replace(COALESCE(v_driver.cnh_number, ''), '\D', '', 'g')) >= 4;
      v_has_phone := length(regexp_replace(COALESCE(v_driver.phone, ''), '\D', '', 'g')) >= 4;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'trip', to_jsonb(v_trip) - 'driver_access_token',
    'vehicle', CASE WHEN v_vehicle.id IS NOT NULL THEN to_jsonb(v_vehicle) ELSE NULL END,
    'driver', CASE
      WHEN v_driver.id IS NOT NULL THEN jsonb_build_object(
        'id', v_driver.id,
        'name', v_driver.name,
        'cnh_category', v_driver.cnh_category,
        'driver_category', v_driver.driver_category,
        'requires_code', (v_has_pin OR v_has_cnh OR v_has_phone),
        'has_pin', v_has_pin,
        'has_cnh', v_has_cnh,
        'has_phone', v_has_phone
      )
      ELSE NULL
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_driver_order_public(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_driver_order_public(text, text) TO anon, authenticated;

-- 5. RPC SEGURA PARA VALIDAR O CÓDIGO DO MOTORISTA 100% NO SERVIDOR (PIN/CNH/TELEFONE NUNCA SAI DO BANCO)
CREATE OR REPLACE FUNCTION public.verify_driver_identity(
  p_trip_id text,
  p_access_token text DEFAULT NULL,
  p_driver_code text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests;
  v_driver RECORD;
  v_clean_code text;
  v_pin text;
  v_cnh_last4 text;
  v_phone_last4 text;
BEGIN
  SELECT * INTO v_trip FROM public.trip_requests WHERE id = p_trip_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Viagem não encontrada.');
  END IF;

  IF v_trip.driver_access_token IS NOT NULL AND trim(v_trip.driver_access_token) <> '' THEN
    IF p_access_token IS NULL OR trim(p_access_token) <> trim(v_trip.driver_access_token) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Link revogado ou inválido.');
    END IF;
  END IF;

  IF v_trip.allocated_driver_id IS NULL THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  SELECT name, access_pin, cnh_number, phone
    INTO v_driver
  FROM public.drivers
  WHERE id = v_trip.allocated_driver_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', true);
  END IF;

  v_clean_code := regexp_replace(COALESCE(p_driver_code, ''), '\D', '', 'g');
  v_pin := regexp_replace(COALESCE(v_driver.access_pin, ''), '\D', '', 'g');
  v_cnh_last4 := right(regexp_replace(COALESCE(v_driver.cnh_number, ''), '\D', '', 'g'), 4);
  v_phone_last4 := right(regexp_replace(COALESCE(v_driver.phone, ''), '\D', '', 'g'), 4);

  IF NOT (length(v_pin) >= 4 OR length(v_cnh_last4) = 4 OR length(v_phone_last4) = 4) THEN
    RETURN jsonb_build_object('valid', true, 'driver_name', v_driver.name);
  END IF;

  IF length(v_clean_code) >= 4 AND (
    (length(v_pin) >= 4 AND v_clean_code = v_pin) OR
    (length(v_cnh_last4) = 4 AND v_clean_code = v_cnh_last4) OR
    (length(v_phone_last4) = 4 AND v_clean_code = v_phone_last4)
  ) THEN
    RETURN jsonb_build_object('valid', true, 'driver_name', v_driver.name);
  END IF;

  RETURN jsonb_build_object(
    'valid', false,
    'error', format('Código incorreto para o motorista escalado (%s). Informe seu PIN ou os 4 últimos dígitos da CNH/telefone cadastrado.', v_driver.name)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_driver_identity(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_driver_identity(text, text, text) TO anon, authenticated;
