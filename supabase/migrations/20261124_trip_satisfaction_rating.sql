-- ============================================================================
-- SIG-FROTA UNILAB — Avaliação de Satisfação via Link Seguro por E-mail (Máx. 3 envios)
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. COLUNAS DE AVALIAÇÃO E CONTROLE DE ENVIO NA TABELA trip_requests
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS rating_overall numeric(2,1),
  ADD COLUMN IF NOT EXISTS rating_punctuality integer,
  ADD COLUMN IF NOT EXISTS rating_vehicle integer,
  ADD COLUMN IF NOT EXISTS rating_driver integer,
  ADD COLUMN IF NOT EXISTS rating_comment text,
  ADD COLUMN IF NOT EXISTS rated_at timestamptz,
  ADD COLUMN IF NOT EXISTS rated_by_name text,
  ADD COLUMN IF NOT EXISTS rating_token text,
  ADD COLUMN IF NOT EXISTS rating_link_sent_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_link_last_sent_at timestamptz;

-- 2. ATUALIZAR RPC DO PAINEL DE TRANSPARÊNCIA (AGREGADO / ANÔNIMO — LGPD)
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

-- 3. ATUALIZAR RPC DE CONSULTA PÚBLICA (NUNCA EXPÕE E-MAIL NEM rating_token)
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
        'rating_link_sent_count', coalesce(t.rating_link_sent_count, 0),
        'has_requester_email', (trim(coalesce(t.requester_email, '')) LIKE '%@%.%'),
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

-- 4. RPC EXCLUSIVA DO SERVIDOR (service_role) PARA GERAR TOKEN E CONTROLAR LIMITE DE 3 ENVIOS
CREATE OR REPLACE FUNCTION public.issue_trip_rating_token(
  p_trip_id text,
  p_process_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests%ROWTYPE;
  v_now timestamptz := now();
  v_email text;
  v_local_part text;
  v_domain_part text;
  v_masked_email text;
  v_token text;
  v_new_count integer;
BEGIN
  SELECT * INTO v_trip
  FROM public.trip_requests
  WHERE id = p_trip_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Viagem não encontrada.');
  END IF;

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

  v_email := lower(trim(coalesce(v_trip.requester_email, '')));
  IF v_email = '' OR position('@' in v_email) <= 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta solicitação não possui um e-mail de solicitante cadastrado. Solicite à DIVTRANS a atualização do e-mail.');
  END IF;

  -- LIMITE MÁXIMO DE 3 ENVIOS POR VIAGEM
  IF coalesce(v_trip.rating_link_sent_count, 0) >= 3 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'limit_reached', true,
      'sent_count', v_trip.rating_link_sent_count,
      'error', 'Limite máximo de 3 envios de link por e-mail já foi atingido para esta viagem. Verifique sua caixa de entrada ou spam.'
    );
  END IF;

  -- Gera token único (ou reaproveita se já existir, garantindo que links anteriores no e-mail continuem válidos)
  v_token := coalesce(nullif(trim(v_trip.rating_token), ''), encode(gen_random_bytes(24), 'hex'));
  v_new_count := coalesce(v_trip.rating_link_sent_count, 0) + 1;

  UPDATE public.trip_requests
  SET
    rating_token = v_token,
    rating_link_sent_count = v_new_count,
    rating_link_last_sent_at = v_now,
    updated_at = v_now
  WHERE id = p_trip_id;

  -- Mascara o e-mail para exibição segura na tela pública (ex: j***@unilab.edu.br)
  v_local_part := split_part(v_email, '@', 1);
  v_domain_part := split_part(v_email, '@', 2);
  v_masked_email := left(v_local_part, LEAST(2, length(v_local_part))) || '***@' || v_domain_part;

  RETURN jsonb_build_object(
    'ok', true,
    'email', v_email,
    'masked_email', v_masked_email,
    'requester_name', v_trip.requester_name,
    'process_number', v_trip.process_number,
    'origin_city_id', v_trip.origin_city_id,
    'destination_city_id', v_trip.destination_city_id,
    'departure_datetime', v_trip.departure_datetime,
    'rating_token', v_token,
    'sent_count', v_new_count,
    'remaining_sends', GREATEST(0, 3 - v_new_count)
  );
END;
$$;

-- APENAS o servidor (service_role) pode chamar esta função — NUNCA o navegador!
REVOKE ALL ON FUNCTION public.issue_trip_rating_token(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_trip_rating_token(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_trip_rating_token(text, text) TO service_role;

-- 5. RPC PÚBLICA PARA ABRIR A PÁGINA DE AVALIAÇÃO COM VALIDAÇÃO DO TOKEN DO E-MAIL
CREATE OR REPLACE FUNCTION public.get_trip_for_rating(
  p_trip_id text,
  p_rating_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests%ROWTYPE;
  v_driver_name text;
BEGIN
  SELECT * INTO v_trip
  FROM public.trip_requests
  WHERE id = p_trip_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF v_trip.rated_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status', 'already_rated',
      'trip', jsonb_build_object(
        'id', v_trip.id,
        'process_number', v_trip.process_number,
        'macro_unit', v_trip.macro_unit,
        'origin_city_id', v_trip.origin_city_id,
        'destination_city_id', v_trip.destination_city_id,
        'departure_datetime', v_trip.departure_datetime,
        'rating_overall', v_trip.rating_overall,
        'rating_punctuality', v_trip.rating_punctuality,
        'rating_vehicle', v_trip.rating_vehicle,
        'rating_driver', v_trip.rating_driver,
        'rating_comment', v_trip.rating_comment,
        'rated_at', v_trip.rated_at
      )
    );
  END IF;

  IF coalesce(trim(v_trip.rating_token), '') = ''
     OR trim(coalesce(p_rating_token, '')) <> trim(v_trip.rating_token) THEN
    RETURN jsonb_build_object('status', 'invalid_token');
  END IF;

  SELECT d.name INTO v_driver_name
  FROM public.drivers d
  WHERE d.id = v_trip.allocated_driver_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'trip', jsonb_build_object(
      'id', v_trip.id,
      'process_number', v_trip.process_number,
      'requester_name', v_trip.requester_name,
      'macro_unit', v_trip.macro_unit,
      'requesting_unit', v_trip.requesting_unit,
      'origin_city_id', v_trip.origin_city_id,
      'destination_city_id', v_trip.destination_city_id,
      'departure_datetime', v_trip.departure_datetime,
      'return_datetime', v_trip.return_datetime,
      'allocated_vehicle_id', v_trip.allocated_vehicle_id,
      'driver_public_name', v_driver_name
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_trip_for_rating(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trip_for_rating(text, text) TO anon, authenticated;

-- 6. RPC SEGURA PARA ENVIAR AVALIAÇÃO EXIGINDO O TOKEN EXCLUSIVO DO E-MAIL
DROP FUNCTION IF EXISTS public.submit_public_trip_rating(text, text, integer, integer, integer, text, text);

CREATE OR REPLACE FUNCTION public.submit_public_trip_rating(
  p_trip_id text,
  p_rating_token text,
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

  IF v_trip.rated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Esta viagem já foi avaliada anteriormente.');
  END IF;

  -- EXIGE TOKEN VÁLIDO ENVIADO AO E-MAIL DO SOLICITANTE
  IF coalesce(trim(v_trip.rating_token), '') = ''
     OR trim(coalesce(p_rating_token, '')) <> trim(v_trip.rating_token) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Link de avaliação inválido ou expirado. Solicite um novo link pelo Portal Público.');
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
    rating_token = NULL, -- Link de uso único: invalida após avaliar
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
