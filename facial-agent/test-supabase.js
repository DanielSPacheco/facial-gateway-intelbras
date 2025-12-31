const path = require("path");

// carrega o .env desta pasta
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("[TEST] started");
console.log("[TEST] env file:", path.join(__dirname, ".env"));
console.log("[TEST] SUPABASE_URL:", process.env.SUPABASE_URL ? "OK" : "MISSING");
console.log("[TEST] SERVICE_ROLE_KEY:", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MISSING");

const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

function withTimeout(promise, ms, label = "timeout") {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label)), ms)
    ),
  ]);
}

async function main() {
  console.log("[TEST] querying jobs...");

  const { data, error } = await withTimeout(
    supabase
      .from("jobs")
      .select("id, site_id, agent_id, type, status, created_at")
      .limit(3),
    8000,
    "Supabase request timed out (8s)"
  );

  console.log("[TEST] data:", data);
  console.log("[TEST] error:", error);
}

main()
  .then(() => console.log("[TEST] done"))
  .catch((err) => {
    console.error("[TEST] failed:", err.message);
    process.exit(1);
  });
