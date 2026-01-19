const { createClient } = require("@supabase/supabase-js");

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // NUNCA no front
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

async function createMember({ email, fullName, role, siteId }) {
  const sb = getAdminClient();

  // 1) cria no Auth + manda invite por e-mail
  const { data, error } = await sb.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role, site_id: siteId },
  });
  if (error) throw error;

  const userId = data.user.id;

  // 2) grava na sua tabela (ex: system_members)
  const { error: e2 } = await sb
    .from("system_members")
    .upsert({
      user_id: userId,
      email,
      full_name: fullName,
      role,
      site_id: siteId,
      status: "invited",
    }, { onConflict: "user_id" });

  if (e2) throw e2;

  return { userId };
}

module.exports = { createMember };
