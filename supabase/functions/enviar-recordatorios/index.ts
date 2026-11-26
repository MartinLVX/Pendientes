// Envía las notificaciones de los recordatorios vencidos.
// La llama pg_cron cada minuto (ver supabase/migrations/*_programar_recordatorios.sql).
// Las claves VAPID y el secreto del cron se leen del Vault de Supabase, no están en el código.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "jsr:@supabase/supabase-js@2";

const APP_URL = "https://martinlvx.github.io/Pendientes/";

Deno.serve(async (req) => {
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: cfg, error: errCfg } = await sb.rpc("config_recordatorios");
  if (errCfg || !cfg) return json({ error: "Sin configuración" }, 500);
  if (req.headers.get("x-cron-secret") !== cfg.recordatorios_cron_secret) {
    return json({ error: "No autorizado" }, 401);
  }

  webpush.setVapidDetails(APP_URL, cfg.vapid_public, cfg.vapid_private);

  const { data: vencidos, error } = await sb.rpc("tomar_recordatorios_vencidos");
  if (error) return json({ error: error.message }, 500);
  if (!vencidos?.length) return json({ enviados: 0 });

  const usuarios = [...new Set(vencidos.map((v: { user_id: string }) => v.user_id))];
  const { data: subs } = await sb
    .from("push_suscripciones")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", usuarios);

  let enviados = 0;
  const caducadas: string[] = [];
  for (const v of vencidos) {
    const payload = JSON.stringify({
      title: "Recordatorio: " + v.texto,
      body: v.descripcion ? v.descripcion.slice(0, 180) : "Toca para abrir tus pendientes.",
      tag: "pendiente-" + v.id,
      url: APP_URL,
    });
    for (const s of (subs ?? []).filter((s) => s.user_id === v.user_id)) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
        enviados++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) caducadas.push(s.id);
        else console.error("Fallo al enviar", code, (e as Error).message);
      }
    }
  }
  if (caducadas.length) await sb.from("push_suscripciones").delete().in("id", caducadas);

  return json({ recordatorios: vencidos.length, enviados, caducadas: caducadas.length });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
