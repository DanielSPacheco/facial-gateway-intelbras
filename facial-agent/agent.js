/**
 * Facial Agent
 * Responsável por:
 * - Buscar jobs pendentes no Supabase
 * - Executar ações no gateway local
 * - Atualizar status do job (done / failed)
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
console.log("[ENV FILE]", path.join(__dirname, ".env"));
console.log("[ENV] RAW AGENT_ID:", process.env.AGENT_ID);

const { createClient } = require("@supabase/supabase-js");

// ========================
// ENV
// ========================
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SITE_ID = process.env.SITE_ID;
const AGENT_ID = process.env.AGENT_ID;

const GATEWAY_BASE_URL =
  process.env.GATEWAY_BASE_URL || "http://127.0.0.1:3000";

const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 1500);

// ========================
// SUPABASE CLIENT
// ========================
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

// ========================
// UTILS
// ========================
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`Missing env var: ${name}`);
  }
}

// ========================
// JOB HANDLERS
// ========================
async function pickNextJob() {
  const { data, error } = await supabase.rpc("pick_next_job", {
    p_site_id: SITE_ID,
    p_agent_id: AGENT_ID,
  });

  if (error) throw error;
  return data; // null ou job
}

async function completeJob(jobId, result) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "done",
      result,
      error_message: null,
    })
    .eq("id", jobId);

  if (error) throw error;
}

async function failJob(jobId, message, result = null) {
  const { error } = await supabase
    .from("jobs")
    .update({
      status: "failed",
      error_message: message,
      result,
    })
    .eq("id", jobId);

  if (error) throw error;
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

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error: "NON_JSON_RESPONSE",
      raw: text,
    };
  }
}

async function callGateway(job) {
  const action = job.type; // vem do banco
  const payload = job.payload || {};

  if (action === "open_door") {
    return httpJson(
      `${GATEWAY_BASE_URL}/facial/door/open`,
      payload
    );
  }

  if (action === "create_user") {
    return httpJson(
      `${GATEWAY_BASE_URL}/facial/user/create`,
      payload
    );
  }

  if (action === "face_upload_base64") {
    return httpJson(
      `${GATEWAY_BASE_URL}/facial/face/uploadBase64`,
      payload
    );
  }

  throw new Error(`Unknown action: ${action}`);
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
  console.log("====================================");

  while (true) {
    try {
      const job = await pickNextJob();

      if (!job || !job.id) {
        await sleep(POLL_INTERVAL_MS);
        continue;
      }

      console.log(`[JOB] picked ${job.id} (${job.type})`);

      const result = await callGateway(job);

      if (result?.ok === true) {
        await completeJob(job.id, result);
        console.log(`[JOB] done ${job.id}`);
      } else {
        await failJob(
          job.id,
          result?.error || "GATEWAY_ERROR",
          result
        );
        console.error(
          `[JOB] failed ${job.id}`,
          result?.error
        );
      }
    } catch (err) {
      console.error("[AGENT ERROR]", err.message);
      await sleep(POLL_INTERVAL_MS);
    }
  }
}

main();