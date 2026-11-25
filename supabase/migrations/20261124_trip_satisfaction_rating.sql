-- ============================================================================
-- SIG-FROTA UNILAB — Avaliação de Satisfação da Viagem pelo Solicitante (Portal Público)
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. COLUNAS DE AVALIAÇÃO NA TABELA trip_requests
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS rating_overall numeric(2,1),
  ADD COLUMN IF NOT EXISTS rating_punctuality integer,
  ADD COLUMN IF NOT EXISTS rating_vehicle integer,
  ADD COLUMN IF NOT EXISTS rating_driver integer,
  ADD COLUMN IF NOT EXISTS rating_comment text,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rated_by_name text;

-- 2. ATUALIZAR RPC DO PAINEL DE TRANSPARÊNCIA PARA INCLUIR AS NOTAS AGREGÁVEIS (SEM DADOS PESSOAIS)
DROP FUNCTION IF EXISTS public.get_public_transparency_trips();

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
  rating_overall numeric,
  rating_punctuality integer,
  rating_vehicle integer,
  rating_driver integer,
  rated_at timestamptz,
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
    t.rating_overall,
    t.rating_punctuality,
    t.rating_vehicle,
    t.rating_driver,
    t.rated_at,
    t.created_at,
    t.updated_at
  FROM public.trip_requests t
  ORDER BY t.departure_datetime ASC;
$$;

REVOKE ALL ON FUNCTION public.get_public_transparency_trips() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_transparency_trips() TO anon, authenticated;

-- 3. ATUALIZAR RPC DE CONSULTA PÚBLICA PARA RETORNAR SE A VIAGEM JÁ FOI AVALIADA
CREATE OR REPLACE FUNCTION public.search_public_trip(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clean text := trim(coalesce(p_query, ''));
  v_results jsonb;
BEGIN
  IF length(v_clean) < 4 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'process_number', t.process_number,
        'received_at', t.received_at,
        'advance_days', t.advance_days,
        'status_deadline', t.status_deadline,
        'requester_name', t.requester_name,
        'macro_unit', t.macro_unit,
        'requesting_unit', t.requesting_unit,
        'activity_type', t.activity_type,
        'trip_objective', t.trip_objective,
        'origin_city_id', t.origin_city_id,
        'destination_city_id', t.destination_city_id,
        'departure_datetime', t.departure_datetime,
        'return_datetime', t.return_datetime,
        'passenger_count', t.passenger_count,
        'estimated_km', t.estimated_km,
        'real_km', t.real_km,
        'status', t.status,
        'rejection_reason', t.rejection_reason,
        'rejection_notes', t.rejection_notes,
        'travel_report_status', t.travel_report_status,
        'driver_checkin_at', t.driver_checkin_at,
        'driver_checkout_at', t.driver_checkout_at,
        'allocated_vehicle_id', t.allocated_vehicle_id,
        'allocated_driver_id', t.allocated_driver_id,
        'allocated_contractor_id', t.allocated_contractor_id,
        'driver_public_name', d.name,
        'rating_overall', t.rating_overall,
        'rating_punctuality', t.rating_punctuality,
        'rating_vehicle', t.rating_vehicle,
        'rating_driver', t.rating_driver,
        'rating_comment', t.rating_comment,
        'rated_at', t.rated_at,
        'created_at', t.created_at,
        'updated_at', t.updated_at
      )
      ORDER BY t.departure_datetime DESC
    ),
    '[]'::jsonb
  )
  INTO v_results
  FROM (
    SELECT *
    FROM public.trip_requests
    WHERE
      process_number ILIKE '%' || v_clean || '%'
      OR id ILIKE '%' || v_clean || '%'
      OR requester_name ILIKE '%' || v_clean || '%'
      OR requesting_unit ILIKE '%' || v_clean || '%'
    ORDER BY departure_datetime DESC
    LIMIT 15
  ) t
  LEFT JOIN public.drivers d ON d.id = t.allocated_driver_id;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public.search_public_trip(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_trip(text) TO anon, authenticated;

-- 4. RPC SEGURA PARA ENVIAR AVALIAÇÃO DE SATISFAÇÃO PELO PORTAL PÚBLICO
CREATE OR REPLACE FUNCTION public.submit_public_trip_rating(
  p_trip_id text,
  p_process_number text,
  p_punctuality integer,
  p_vehicle integer,
  p_driver integer,
  p_comment text DEFAULT NULL,
  p_rater_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests%ROWTYPE;
  v_overall numeric(2,1);
  v_now timestamptz := now();
  v_clean_comment text := left(trim(coalesce(p_comment, '')), 500);
  v_clean_rater text := left(trim(coalesce(p_rater_name, '')), 120);
BEGIN
  IF p_punctuality NOT BETWEEN 1 AND 5
     OR p_vehicle NOT BETWEEN 1 AND 5
     OR p_driver NOT BETWEEN 1 AND 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'As notas devem estar entre 1 e 5 estrelas.');
  END IF;

  SELECT * INTO v_trip
  FROM public.trip_requests
  WHERE id = p_trip_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Viagem não encontrada.');
  END IF;

  -- Confirmação do número do processo para evitar envio aleatório por ID
  IF trim(coalesce(v_trip.process_number, '')) <> trim(coalesce(p_process_number, '')) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Número do processo não confere.');
  END IF;

  IF v_trip.status <> 'Confirmado ao Demandante' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Apenas viagens confirmadas e concluídas podem ser avaliadas.');
  END IF;

  IF v_trip.driver_checkout_at IS NULL
     AND coalesce(v_trip.travel_report_status, '') NOT IN ('Finalizado no Sistema', 'Aguardando a Apreciação do Gerente')
     AND v_trip.return_datetime > v_now THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A avaliação é liberada somente após a conclusão da viagem.');
  END IF;

  IF v_trip.rated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta viagem já foi avaliada anteriormente.');
  END IF;

  v_overall := round(((p_punctuality + p_vehicle + p_driver)::numeric / 3.0), 1);

  UPDATE public.trip_requests
  SET
    rating_overall = v_overall,
    rating_punctuality = p_punctuality,
    rating_vehicle = p_vehicle,
    rating_driver = p_driver,
    rating_comment = NULLIF(v_clean_comment, ''),
    rated_at = v_now,
    rated_by_name = NULLIF(v_clean_rater, ''),
    updated_at = v_now
  WHERE id = p_trip_id;

  RETURN jsonb_build_object(
    'ok', true,
    'rating_overall', v_overall,
    'rating_punctuality', p_punctuality,
    'rating_vehicle', p_vehicle,
    'rating_driver', p_driver,
    'rating_comment', NULLIF(v_clean_comment, ''),
    'rated_at', v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_trip_rating(text, text, integer, integer, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_trip_rating(text, text, integer, integer, integer, text, text) TO anon, authenticated;
