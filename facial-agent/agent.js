/**
 * FACIAL AGENT (Enterprise) — robusto + isolamento por device
 *
 * Requisitos:
 * - Node 18+ (fetch nativo)
 * - SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 * - SITE_ID / AGENT_ID
 *
 * Convenções:
 * - jobs.payload.device_id = UUID do device em public.facials
 * - Agent busca o device no DB e injeta "target" no payload enviado ao gateway
 *
 * Observação:
 * - O Gateway precisa suportar receber o target (ip/channel) no body.
 */

const path = require("path");
const net = require("net");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createClient } = require("@supabase/supabase-js");

// ========================
// ENV
// ========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE_ID = process.env.SITE_ID;
const AGENT_ID = process.env.AGENT_ID;

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || "http://127.0.0.1:4000";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1500);

// Job status
const JOB_STATUS_PENDING = process.env.JOB_STATUS_PENDING || "pending";
const JOB_STATUS_PROCESSING = process.env.JOB_STATUS_PROCESSING || "processing";
const JOB_STATUS_DONE = process.env.JOB_STATUS_DONE || "done";
const JOB_STATUS_FAILED = process.env.JOB_STATUS_FAILED || "failed";

// Timeouts
const DEFAULT_HTTP_TIMEOUT_MS = Number(process.env.DEFAULT_HTTP_TIMEOUT_MS || 30000);
const FACE_HTTP_TIMEOUT_MS = Number(process.env.FACE_HTTP_TIMEOUT_MS || 60000);

// Heartbeat
const HEARTBEAT_ENABLED = (process.env.HEARTBEAT_ENABLED ?? "true") === "true";
const HEARTBEAT_LOOP_MS = Number(process.env.HEARTBEAT_LOOP_MS || 5000);
const HEARTBEAT_TCP_PORT = Number(process.env.HEARTBEAT_TCP_PORT || 80);
const HEARTBEAT_TCP_TIMEOUT_MS = Number(process.env.HEARTBEAT_TCP_TIMEOUT_MS || 1200);

// ========================
// UTILS
// ========================
function requireEnv(name) {
  if (!process.env[name]) throw new Error(`Missing env var: ${name}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function isSchemaCacheError(err) {
  const msg = String(err?.message || err || "");
  return msg.includes("schema cache") || msg.includes("Could not find the");
}

// ========================
// SUPABASE CLIENT
// ========================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ========================
// DB: DEVICES (facials)
// ========================
async function listSiteDevices() {
  const { data, error } = await supabase
    .from("facials")
    .select("id, site_id, name, ip, channel, client_id, keep_alive_enabled, probing_interval, protocol")
    .eq("site_id", SITE_ID);

  if (error) throw error;
  return data || [];
}

async function getDeviceById(deviceId) {
  const { data, error } = await supabase
    .from("facials")
    .select("id, site_id, name, ip, channel, client_id, keep_alive_enabled, probing_interval, protocol")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function updateDevicePresence(deviceId, patch) {
  // patch esperado: { status, last_seen_at, latency_ms }
  try {
    const { error } = await supabase.from("facials").update(patch).eq("id", deviceId);
    if (error) throw error;
  } catch (err) {
    // Se schema cache ainda não atualizou, não derruba o agent.
    if (isSchemaCacheError(err)) {
      console.warn("[HB] schema cache outdated. Run: NOTIFY pgrst, 'reload schema';");
      // tenta atualizar pelo menos o status (coluna já existe no seu print)
      try {
        const safePatch = {};
        if (typeof patch.status !== "undefined") safePatch.status = patch.status;
        if (Object.keys(safePatch).length) {
          const { error } = await supabase.from("facials").update(safePatch).eq("id", deviceId);
          if (error) throw error;
        }
      } catch (e2) {
        console.warn("[HB] fallback update failed:", e2?.message || e2);
      }
      return;
    }
    throw err;
  }
}

// ========================
// DB: JOBS
// ========================
async function findPendingJob() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("status", JOB_STATUS_PENDING)
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso()}`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

async function lockJob(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .update({
      status: JOB_STATUS_PROCESSING,
      agent_id: AGENT_ID,
      locked_at: nowIso(),
      locked_by: AGENT_ID,
      updated_at: nowIso(),
    })
    .eq("id", jobId)
    .eq("status", JOB_STATUS_PENDING)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function completeJob(jobId, result) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: JOB_STATUS_DONE,
      result,
      error_message: null,
      executed_at: nowIso(),
      locked_at: null,
      locked_by: null,
      updated_at: nowIso(),
    })
    .eq("id", jobId);

  if (error) throw error;
}

async function failOrRetryJob(job, message, result = null) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 3);

  if (attempts + 1 < maxAttempts) {
    const { error } = await supabase
      .from("jobs")
      .update({
        status: JOB_STATUS_PENDING,
        attempts: attempts + 1,
        error_message: message,
        result,
        locked_at: null,
        locked_by: null,
        updated_at: nowIso(),
      })
      .eq("id", job.id);

    if (error) throw error;
    return { retried: true, attempts: attempts + 1, maxAttempts };
  }

  const { error } = await supabase
    .from("jobs")
    .update({
      status: JOB_STATUS_FAILED,
      attempts: attempts + 1,
      error_message: message,
      result,
      executed_at: nowIso(),
      locked_at: null,
      locked_by: null,
      updated_at: nowIso(),
    })
    .eq("id", job.id);

  if (error) throw error;
  return { retried: false, attempts: attempts + 1, maxAttempts };
}

// ========================
// HTTP: POST JSON w/ timeout
// ========================
async function httpJson(url, body, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });

    const text = await resp.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: false, error: "NON_JSON_RESPONSE", raw: text };
    }

    if (typeof parsed.ok === "undefined") parsed.ok = resp.ok;
    if (!parsed.ok) parsed.http_status = resp.status;

    return parsed;
  } catch (err) {
    return {
      ok: false,
      error: err?.name === "AbortError" ? "TIMEOUT" : (err?.message || "FETCH_ERROR"),
    };
  } finally {
    clearTimeout(t);
  }
}

// ========================
// GATEWAY CALL (job.type -> endpoint)
// ========================
function normalizeAction(type) {
  const t = String(type || "").trim();
  if (!t) return "";
  return t;
}

async function callGateway(job, target) {
  const action = normalizeAction(job.type);
  const payload = job.payload || {};

  // Aqui está o pulo do gato:
  // injeta target no payload para o gateway saber qual dispositivo atingir
  const withTarget = target ? { ...payload, target } : payload;

  switch (action) {
    case "open_door":
      return httpJson(`${GATEWAY_BASE_URL}/facial/door/open`, withTarget);

    case "create_user":
    case "user_create":
      return httpJson(`${GATEWAY_BASE_URL}/facial/user/create`, withTarget);

    case "update_user":
    case "user_update":
      return httpJson(`${GATEWAY_BASE_URL}/facial/user/update`, withTarget);

    case "delete_user":
    case "user_delete":
      return httpJson(`${GATEWAY_BASE_URL}/facial/user/delete`, withTarget);

    case "add_card":
    case "card_add":
      return httpJson(`${GATEWAY_BASE_URL}/facial/card/add`, withTarget);

    case "delete_card":
    case "card_delete":
      return httpJson(`${GATEWAY_BASE_URL}/facial/card/delete`, withTarget);

    case "upload_face_base64":
    case "face_upload_base64":
      // operações de face geralmente demoram mais
      return httpJson(`${GATEWAY_BASE_URL}/facial/face/uploadBase64`, withTarget, FACE_HTTP_TIMEOUT_MS);

    default:
      return { ok: false, error: `UNKNOWN_ACTION:${action}` };
  }
}

// ========================
// HEARTBEAT (TCP ping)
// ========================
function tcpPing(ip, port, timeoutMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    const done = (ok) => {
      try { socket.destroy(); } catch {}
      const latency = Date.now() - start;
      resolve({ ok, latency_ms: ok ? latency : null });
    };

    socket.setTimeout(timeoutMs);

    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));

    socket.connect(port, ip);
  });
}

async function heartbeatLoop() {
  if (!HEARTBEAT_ENABLED) return;

  console.log("[HB] Heartbeat loop started:", {
    enabled: HEARTBEAT_ENABLED,
    loopMs: HEARTBEAT_LOOP_MS,
    tcpPort: HEARTBEAT_TCP_PORT,
    tcpTimeoutMs: HEARTBEAT_TCP_TIMEOUT_MS,
  });

  while (true) {
    try {
      const devices = await listSiteDevices();

      for (const d of devices) {
        const ip = d.ip;
        if (!ip) continue;

        const r = await tcpPing(ip, HEARTBEAT_TCP_PORT, HEARTBEAT_TCP_TIMEOUT_MS);

        const patch = {
          status: r.ok ? "online" : "offline",
          last_seen_at: r.ok ? nowIso() : null,
          latency_ms: r.ok ? r.latency_ms : null,
        };

        await updateDevicePresence(d.id, patch);
      }
    } catch (err) {
      console.warn("[HB] error:", err?.message || err);
    }

    await sleep(HEARTBEAT_LOOP_MS);
  }
}

// ========================
// MAIN LOOP
// ========================
async function main() {
  requireEnv("SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("SITE_ID");
  requireEnv("AGENT_ID");

  console.log("====================================");
  console.log("🤖 FACIAL AGENT (Enterprise) STARTED");
  console.log("SITE_ID :", SITE_ID);
  console.log("AGENT_ID:", AGENT_ID);
  console.log("GATEWAY :", GATEWAY_BASE_URL);
  console.log("POLL   :", POLL_INTERVAL_MS, "ms");
  console.log("====================================");

  // roda heartbeat em paralelo
  heartbeatLoop().catch((e) => console.warn("[HB] loop crashed:", e?.message || e));

  while (true) {
    try {
      const pending = await findPendingJob();

      if (!pending) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = await lockJob(pending.id);
      if (!job) {
        await sleep(250);
        continue;
      }

      const deviceId = job?.payload?.device_id || job?.payload?.deviceId || null;

      // target que o gateway vai usar
      let target = null;

      if (deviceId) {
        const device = await getDeviceById(deviceId);
        if (!device) {
          const info = await failOrRetryJob(job, `DEVICE_NOT_FOUND:${deviceId}`, { deviceId });
          console.warn(`[JOB] ${job.id} device not found -> ${info.retried ? "retry" : "failed"}`);
          continue;
        }

        target = {
          device_id: device.id,
          ip: device.ip,
          channel: device.channel ?? 1,
          protocol: device.protocol || "intelbras",
          name: device.name || null,
        };
      }

      console.log(`[JOB] locked ${job.id} (${job.type}) device=${deviceId || "none"}`);

      const result = await callGateway(job, target);

      if (result?.ok === true) {
        await completeJob(job.id, result);
        console.log(`[JOB] done   ${job.id}`);
      } else {
        const reason =
          typeof result?.error === "string"
            ? result.error
            : result?.error?.message
              ? result.error.message
              : result?.error
                ? JSON.stringify(result.error)
                : "GATEWAY_ERROR";

        const info = await failOrRetryJob(job, reason, result);
        if (info.retried) {
          console.warn(`[JOB] retry  ${job.id} (${info.attempts}/${info.maxAttempts}) reason=${reason}`);
        } else {
          console.error(`[JOB] failed ${job.id} FINAL (${info.attempts}/${info.maxAttempts}) reason=${reason}`);
        }
      }
    } catch (err) {
      console.error("[AGENT ERROR]", err?.message || err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

main();