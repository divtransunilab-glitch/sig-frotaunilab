-- ============================================================================
-- SIG-FROTA UNILAB — KM por Trecho (trip_legs) & Controle de Tráfego Mensal
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Adicionar coluna jsonb para armazenar os trechos detalhados (Ida, Paradas, Volta)
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS trip_legs jsonb;

-- 2. Atualizar função RPC segura do motorista para aceitar p_trip_legs
CREATE OR REPLACE FUNCTION public.driver_update_trip_execution(
  p_trip_id text,
  p_action text, -- 'checkin' | 'checkout'
  p_odometer_start numeric DEFAULT NULL,
  p_odometer_end numeric DEFAULT NULL,
  p_real_km numeric DEFAULT NULL,
  p_fuel_liters numeric DEFAULT NULL,
  p_toll_amount numeric DEFAULT NULL,
  p_report_notes text DEFAULT NULL,
  p_event_timestamp timestamptz DEFAULT now(),
  p_trip_legs jsonb DEFAULT NULL
)
RETURNS public.trip_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests;
  v_calc_km numeric;
BEGIN
  SELECT * INTO v_trip
  FROM public.trip_requests
  WHERE id = p_trip_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Viagem não encontrada para o identificador informado.';
  END IF;

  IF v_trip.status IS DISTINCT FROM 'Confirmado ao Demandante' THEN
    RAISE EXCEPTION 'Apenas viagens confirmadas podem receber registro de bordo.';
  END IF;

  IF v_trip.travel_report_status = 'Finalizado no Sistema' THEN
    RAISE EXCEPTION 'Esta viagem já foi homologada e finalizada pelo gestor.';
  END IF;

  IF p_action = 'checkin' THEN
    UPDATE public.trip_requests
    SET
      driver_checkin_at = COALESCE(p_event_timestamp, now()),
      odometer_start = COALESCE(p_odometer_start, odometer_start),
      trip_legs = COALESCE(p_trip_legs, trip_legs),
      report_notes = COALESCE(NULLIF(trim(p_report_notes), ''), report_notes),
      updated_at = now()
    WHERE id = p_trip_id
    RETURNING * INTO v_trip;

    RETURN v_trip;
  ELSIF p_action = 'checkout' THEN
    v_calc_km := COALESCE(
      p_real_km,
      CASE
        WHEN COALESCE(p_odometer_start, v_trip.odometer_start) IS NOT NULL
         AND p_odometer_end IS NOT NULL
         AND p_odometer_end >= COALESCE(p_odometer_start, v_trip.odometer_start)
        THEN p_odometer_end - COALESCE(p_odometer_start, v_trip.odometer_start)
        ELSE v_trip.estimated_km
      END
    );

    UPDATE public.trip_requests
    SET
      driver_checkin_at = COALESCE(driver_checkin_at, p_event_timestamp, now()),
      driver_checkout_at = COALESCE(p_event_timestamp, now()),
      odometer_start = COALESCE(p_odometer_start, odometer_start),
      odometer_end = COALESCE(p_odometer_end, odometer_end),
      trip_legs = COALESCE(p_trip_legs, trip_legs),
      real_km = v_calc_km,
      fuel_liters = COALESCE(p_fuel_liters, fuel_liters),
      toll_amount = COALESCE(p_toll_amount, toll_amount),
      report_notes = COALESCE(NULLIF(trim(p_report_notes), ''), report_notes),
      travel_report_status = 'Aguardando a Apreciação do Gerente',
      report_submitted_at = now(),
      updated_at = now()
    WHERE id = p_trip_id
    RETURNING * INTO v_trip;

    RETURN v_trip;
  ELSE
    RAISE EXCEPTION 'Ação inválida: utilize checkin ou checkout.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.driver_update_trip_execution(text, text, numeric, numeric, numeric, numeric, numeric, text, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_update_trip_execution(text, text, numeric, numeric, numeric, numeric, numeric, text, timestamptz, jsonb) TO anon, authenticated;
