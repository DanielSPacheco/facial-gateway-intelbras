function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function envNumber(name, def) {
  const v = process.env[name];
  if (!v) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

function envString(name, def) {
  return process.env[name] || def;
}

function getConfig() {
  // RPC2 / RPC2_Login (Dahua style)
  const FACIAL_IP = required("FACIAL_IP");
  const FACIAL_USER = required("FACIAL_USER");
  const FACIAL_PASS = required("FACIAL_PASS");

  return {
    PORT: envNumber("PORT", 3000),
    TIMEOUT_MS: envNumber("TIMEOUT_MS", 15000),

    FACIAL_IP,
    FACIAL_USER,
    FACIAL_PASS,

    // CGI openDoor endpoint uses "channel"
    FACIAL_CHANNEL: envString("FACIAL_CHANNEL", "1"),
  };
}

module.exports = { getConfig };