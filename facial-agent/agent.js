/**
 * Facial Agent (versão limpa e robusta)
 *
 * Fluxo:
 * 1) procura 1 job "pending" do SITE
 * 2) tenta travar (lock) mudando para "processing" (só se ainda estiver pending)
 * 3) chama o gateway local
 * 4) atualiza job para "done" ou "failed"
 *    - se falhar e ainda tiver tentativas: volta pra "pending" e incrementa attempts
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { createClient } = require("@supabase/supabase-js");

// ========================
// ENV
// ========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE_ID = process.env.SITE_ID;
const AGENT_ID = process.env.AGENT_ID;

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || "http://127.0.0.1:3000";
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1500);

// Status (precisa bater com o CHECK constraint)
const JOB_STATUS_PENDING = process.env.JOB_STATUS_PENDING || "pending";
const JOB_STATUS_PROCESSING = process.env.JOB_STATUS_PROCESSING || "processing";
const JOB_STATUS_DONE = process.env.JOB_STATUS_DONE || "done";
const JOB_STATUS_FAILED = process.env.JOB_STATUS_FAILED || "failed";

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

// ========================
// SUPABASE CLIENT
// ========================
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ========================
// DB: FIND PENDING
// ========================
async function findPendingJob() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("site_id", SITE_ID)
    .eq("status", JOB_STATUS_PENDING)
    // opcional: respeitar agendamento
    .or(`scheduled_for.is.null,scheduled_for.lte.${nowIso()}`)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0] || null;
}

// ========================
// DB: LOCK (atomic-ish)
// ========================
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
    .eq("status", JOB_STATUS_PENDING) // só trava se ainda estiver pending
    .select("*")
    .maybeSingle();

  if (error) throw error;
  return data || null; // null = alguém pegou antes
}

// ========================
// DB: COMPLETE
// ========================
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

// ========================
// DB: FAIL (com retry)
// ========================
async function failOrRetryJob(job, message, result = null) {
  const attempts = Number(job.attempts || 0);
  const maxAttempts = Number(job.max_attempts || 3);

  // Se ainda tem tentativa: volta pra pending e incrementa attempts
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

  // Senão: falha definitivo
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
// GATEWAY CALL
// ========================
async function httpJson(url, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const text = await resp.text();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { ok: false, error: "NON_JSON_RESPONSE", raw: text };
  }

  // Se gateway não devolver "ok", inferimos pelo HTTP status
  if (typeof parsed.ok === "undefined") parsed.ok = resp.ok;

  // Se não ok, injeta status/http pra debug
  if (!parsed.ok) {
    parsed.http_status = resp.status;
  }

  return parsed;
}

async function callGateway(job) {
  const action = job.type;
  const payload = job.payload || {};

  switch (action) {
    case "open_door":
      return httpJson(`${GATEWAY_BASE_URL}/facial/door/open`, payload);

    case "create_user":
      return httpJson(`${GATEWAY_BASE_URL}/facial/user/create`, payload);

    case "face_upload_base64":
      return httpJson(`${GATEWAY_BASE_URL}/facial/face/uploadBase64`, payload);

    default:
      return { ok: false, error: `UNKNOWN_ACTION:${action}` };
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
  console.log("🤖 FACIAL AGENT STARTED");
  console.log("SITE_ID :", SITE_ID);
  console.log("AGENT_ID:", AGENT_ID);
  console.log("GATEWAY :", GATEWAY_BASE_URL);
  console.log("POLL   :", POLL_INTERVAL_MS, "ms");
  console.log("STATUS :", {
    pending: JOB_STATUS_PENDING,
    processing: JOB_STATUS_PROCESSING,
    done: JOB_STATUS_DONE,
    failed: JOB_STATUS_FAILED,
  });
  console.log("====================================");

  while (true) {
    try {
      const pending = await findPendingJob();

      if (!pending) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      const job = await lockJob(pending.id);
      if (!job) {
        // outro agente pegou, ou corrida
        await sleep(250);
        continue;
      }

      console.log(`[JOB] locked ${job.id} (${job.type}) attempts=${job.attempts || 0}/${job.max_attempts || 3}`);

      const result = await callGateway(job);

      if (result?.ok === true) {
        await completeJob(job.id, result);
        console.log(`[JOB] done   ${job.id}`);
      } else {
        const reason = result?.error || "GATEWAY_ERROR";
        const info = await failOrRetryJob(job, reason, result);
        if (info.retried) {
          console.warn(`[JOB] retry  ${job.id} -> pending (${info.attempts}/${info.maxAttempts}) reason=${reason}`);
        } else {
          console.error(`[JOB] failed ${job.id} (final) (${info.attempts}/${info.maxAttempts}) reason=${reason}`);
        }
      }
    } catch (err) {
      console.error("[AGENT ERROR]", err?.message || err);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main(); 