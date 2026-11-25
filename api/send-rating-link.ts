// Vercel Serverless Function — POST /api/send-rating-link
// Gera um token de avaliação exclusivo (máx. 3 envios no PostgreSQL) e envia o link por e-mail ao solicitante.
// NUNCA retorna o e-mail completo nem o token para o navegador (LGPD + Segurança).

function escapeHtml(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const tripId = String(body.tripId || '').trim();
    const processNumber = String(body.processNumber || '').trim();

    if (!tripId || !processNumber) {
      res.status(400).json({ ok: false, error: 'Dados da solicitação incompletos.' });
      return;
    }

    const rawSupabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    // Remove /rest/v1 ou barras finais caso o usuário tenha colado a URL completa da Data API
    const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({
        ok: false,
        error:
          'Variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar configuradas na Vercel para enviar links seguros por e-mail.',
      });
      return;
    }

    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const emailWebhookUrl = (process.env.EMAIL_WEBHOOK_URL || '').trim();
    const emailFrom = process.env.EMAIL_FROM || 'SIG-FROTA UNILAB <onboarding@resend.dev>';

    if (!resendApiKey && !emailWebhookUrl) {
      res.status(500).json({
        ok: false,
        error:
          'Serviço de envio de e-mail ainda não configurado na Vercel (adicione RESEND_API_KEY ou EMAIL_WEBHOOK_URL nas variáveis de ambiente).',
      });
      return;
    }

    // 1. Emite token exclusivo no Supabase (compatível com chave legacy JWT `eyJ...` e nova `sb_secret_...`)
    const supabaseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      apikey: serviceRoleKey,
    };
    if (!serviceRoleKey.startsWith('sb_secret_')) {
      supabaseHeaders.Authorization = `Bearer ${serviceRoleKey}`;
    }

    const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/issue_trip_rating_token`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify({
        p_trip_id: tripId,
        p_process_number: processNumber,
      }),
    });

    if (!rpcResponse.ok) {
      const errText = await rpcResponse.text();
      console.error('Supabase RPC error:', rpcResponse.status, errText);
      let friendlyMsg = `Erro ao validar a viagem no servidor (HTTP ${rpcResponse.status}).`;
      if (errText.includes('issue_trip_rating_token')) {
        friendlyMsg = 'Migração SQL da avaliação por e-mail ainda não foi executada no Supabase.';
      } else if (errText.includes('gen_random_bytes')) {
        friendlyMsg = 'Atualize o script SQL no Supabase (search_path extensions para geração de token).';
      } else if (rpcResponse.status === 401 || rpcResponse.status === 403) {
        friendlyMsg = 'Chave SUPABASE_SERVICE_ROLE_KEY inválida ou sem permissão na Vercel.';
      }
      res.status(500).json({
        ok: false,
        error: friendlyMsg,
      });
      return;
    }

    const rpcData = await rpcResponse.json();
    if (!rpcData || !rpcData.ok) {
      res.status(400).json({
        ok: false,
        limit_reached: Boolean(rpcData?.limit_reached),
        sent_count: rpcData?.sent_count,
        error: rpcData?.error || 'Não foi possível gerar o link de avaliação.',
      });
      return;
    }

    // 2. Monta URL exclusiva de avaliação
    const proto = req.headers?.['x-forwarded-proto'] || 'https';
    const host = req.headers?.['x-forwarded-host'] || req.headers?.host || 'sig-frotaunilab.vercel.app';
    const siteOrigin = (process.env.PUBLIC_SITE_URL || `${proto}://${host}`).replace(/\/$/, '');
    const ratingUrl = `${siteOrigin}/?avaliar=${encodeURIComponent(tripId)}&rt=${encodeURIComponent(rpcData.rating_token)}`;

    const safeRequester = escapeHtml(rpcData.requester_name || 'Solicitante');
    const safeProcess = escapeHtml(rpcData.process_number || processNumber);
    const subject = `[SIG-FROTA UNILAB] Avalie sua viagem — Processo ${rpcData.process_number || processNumber}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
        <div style="background: #0f172a; color: #ffffff; padding: 20px 24px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #cbd5e1; font-weight: bold;">
            UNILAB • DIVTRANS / PROADI
          </div>
          <h2 style="margin: 6px 0 0 0; font-size: 18px;">Avaliação de Satisfação do Transporte</h2>
        </div>
        <div style="padding: 24px; background: #ffffff; font-size: 14px; line-height: 1.6;">
          <p>Olá, <strong>${safeRequester}</strong>!</p>
          <p>
            Foi solicitado o link exclusivo para avaliar o transporte oficial referente ao processo
            <strong>${safeProcess}</strong>.
          </p>
          <p>A avaliação leva apenas 10 segundos (Pontualidade, Veículo e Atendimento do Motorista):</p>
          <div style="text-align: center; margin: 26px 0;">
            <a href="${ratingUrl}" style="display: inline-block; background: #b45309; color: #ffffff; text-decoration: none; font-weight: bold; padding: 13px 26px; border-radius: 12px; font-size: 14px;">
              ★ Avaliar Minha Viagem Agora
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b;">
            Este link é pessoal, de uso único e destinado exclusivamente ao e-mail cadastrado na solicitação.
            Caso você não tenha solicitado, basta ignorar esta mensagem.
          </p>
          <p style="font-size: 11px; color: #94a3b8; word-break: break-all;">
            Link direto: ${ratingUrl}
          </p>
        </div>
      </div>
    `;

    // 3. Dispara e-mail via Resend ou Webhook (Google Apps Script / Gmail)
    if (resendApiKey) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [rpcData.email],
          subject,
          html: htmlBody,
        }),
      });

      if (!resendRes.ok) {
        const resendErr = await resendRes.text();
        console.error('Resend error:', resendErr);
        res.status(502).json({
          ok: false,
          error: 'Falha ao disparar o e-mail pelo provedor Resend. Verifique a configuração do domínio/remetente.',
        });
        return;
      }
    } else if (emailWebhookUrl) {
      const webhookRes = await fetch(emailWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: rpcData.email,
          subject,
          htmlBody,
          processNumber: rpcData.process_number,
          ratingUrl,
        }),
      });

      if (!webhookRes.ok) {
        console.error('Email webhook error:', await webhookRes.text());
        res.status(502).json({
          ok: false,
          error: 'Falha ao disparar o e-mail pelo webhook configurado.',
        });
        return;
      }
    }

    // 4. Retorna ao navegador APENAS dados mascarados e contagem (nunca o e-mail real nem o token!)
    res.status(200).json({
      ok: true,
      masked_email: rpcData.masked_email,
      sent_count: rpcData.sent_count,
      remaining_sends: rpcData.remaining_sends,
    });
  } catch (err: any) {
    console.error('send-rating-link error:', err);
    res.status(500).json({ ok: false, error: 'Erro interno ao processar o envio do link de avaliação.' });
  }
}
