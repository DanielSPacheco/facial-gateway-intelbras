const { runCurlDigest } = require("../clients/cgi.client");

async function openDoor(cfg) {
  const baseUrl = `http://${cfg.FACIAL_IP}`;
  const path = `/cgi-bin/accessControl.cgi?action=openDoor&channel=${encodeURIComponent(cfg.FACIAL_CHANNEL)}`;

  const r = await runCurlDigest({
    baseUrl,
    user: cfg.FACIAL_USER,
    pass: cfg.FACIAL_PASS,
    timeoutMs: cfg.TIMEOUT_MS,
    method: "GET",
    path,
  });

  return {
    ok: r.ok,
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 2000),
    error: (r.stderr || "").slice(0, 2000),
  };
}

module.exports = { openDoor };