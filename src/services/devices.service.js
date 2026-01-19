const { makeSupabaseAdminClient } = require("../clients/supabase.client");

async function getFacialById(deviceId) {
  const supabase = makeSupabaseAdminClient();

  const { data, error } = await supabase
    .from("facials")
    .select("id, site_id, name, ip, channel, status, last_seen_at, latency_ms")
    .eq("id", deviceId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

module.exports = { getFacialById };
