-- ============================================================================
-- SIG-FROTA UNILAB — Autenticação do Motorista (Token + PIN/CNH) & Homologação com Nome/Cargo
-- Execute este script no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================================

-- 1. Colunas de rastreabilidade do motorista e homologação do gestor em trip_requests
ALTER TABLE public.trip_requests
  ADD COLUMN IF NOT EXISTS driver_access_token text,
  ADD COLUMN IF NOT EXISTS driver_verified_name text,
  ADD COLUMN IF NOT EXISTS driver_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_approved_by_name text,
  ADD COLUMN IF NOT EXISTS report_approved_by_role text;

-- 2. PIN opcional de 4 dígitos no cadastro de motoristas
ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS access_pin text;

-- 3. Função RPC segura atualizada: valida Token único da viagem + PIN/CNH/Telefone do motorista escalado
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
  p_trip_legs jsonb DEFAULT NULL,
  p_access_token text DEFAULT NULL,
  p_driver_code text DEFAULT NULL
)
RETURNS public.trip_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip public.trip_requests;
  v_driver RECORD;
  v_calc_km numeric;
  v_clean_code text;
  v_pin text;
  v_cnh_last4 text;
  v_phone_last4 text;
  v_verified_name text;
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

  -- Validação 1: Token único por viagem (revogado automaticamente se trocar o motorista na escala)
  IF v_trip.driver_access_token IS NOT NULL AND trim(v_trip.driver_access_token) <> '' THEN
    IF p_access_token IS NULL OR trim(p_access_token) <> trim(v_trip.driver_access_token) THEN
      RAISE EXCEPTION 'Link revogado ou inválido. Solicite o link atualizado à DIVTRANS.';
    END IF;
  END IF;

  -- Validação 2: Identidade do motorista escalado (PIN de 4 dígitos ou 4 últimos dígitos da CNH/Telefone)
  v_verified_name := v_trip.driver_verified_name;
  IF v_trip.allocated_driver_id IS NOT NULL THEN
    SELECT name, access_pin, cnh_number, phone
      INTO v_driver
    FROM public.drivers
    WHERE id = v_trip.allocated_driver_id;

    IF FOUND THEN
      v_clean_code := regexp_replace(COALESCE(p_driver_code, ''), '\D', '', 'g');
      v_pin := regexp_replace(COALESCE(v_driver.access_pin, ''), '\D', '', 'g');
      v_cnh_last4 := right(regexp_replace(COALESCE(v_driver.cnh_number, ''), '\D', '', 'g'), 4);
      v_phone_last4 := right(regexp_replace(COALESCE(v_driver.phone, ''), '\D', '', 'g'), 4);

      -- Se o motorista possui PIN, CNH ou telefone cadastrado, exige correspondência
      IF (length(v_pin) >= 4 OR length(v_cnh_last4) = 4 OR length(v_phone_last4) = 4) THEN
        IF length(v_clean_code) < 4 OR NOT (
          (length(v_pin) >= 4 AND v_clean_code = v_pin) OR
          (length(v_cnh_last4) = 4 AND v_clean_code = v_cnh_last4) OR
          (length(v_phone_last4) = 4 AND v_clean_code = v_phone_last4)
        ) THEN
          RAISE EXCEPTION 'Código de identificação inválido para o motorista escalado (%). Informe seu PIN ou os 4 últimos dígitos da CNH/telefone cadastrado.', v_driver.name;
        END IF;
      END IF;

      v_verified_name := v_driver.name;
    END IF;
  END IF;

  IF p_action = 'checkin' THEN
    UPDATE public.trip_requests
    SET
      driver_checkin_at = COALESCE(p_event_timestamp, now()),
      odometer_start = COALESCE(p_odometer_start, odometer_start),
      trip_legs = COALESCE(p_trip_legs, trip_legs),
      driver_verified_name = COALESCE(v_verified_name, driver_verified_name),
      driver_verified_at = COALESCE(driver_verified_at, now()),
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
      driver_verified_name = COALESCE(v_verified_name, driver_verified_name),
      driver_verified_at = COALESCE(driver_verified_at, now()),
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

REVOKE ALL ON FUNCTION public.driver_update_trip_execution(text, text, numeric, numeric, numeric, numeric, numeric, text, timestamptz, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.driver_update_trip_execution(text, text, numeric, numeric, numeric, numeric, numeric, text, timestamptz, jsonb, text, text) TO anon, authenticated;
