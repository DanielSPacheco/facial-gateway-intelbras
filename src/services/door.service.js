const { runCurlDigestBuffer } = require("../clients/cgi.client");
const { resolveTarget } = require("../utils/target.util");

async function openDoor(cfg, body = {}) {
  const tcfg = resolveTarget(cfg, body);

  const channel = String(tcfg.FACIAL_CHANNEL ?? "1");
  const url = `http://${tcfg.FACIAL_IP}/cgi-bin/accessControl.cgi?action=openDoor&channel=${channel}`;

  const r = await runCurlDigestBuffer({
    url,
    user: tcfg.FACIAL_USER,
    pass: tcfg.FACIAL_PASS,
    timeoutMs: tcfg.TIMEOUT_MS,
  });

  if (!r.ok) {
    return {
      ok: false,
      command: "openDoor",
      url,
      error: r.stderr || `curl_exit_code:${r.code}`,
    };
  }

  return {
    ok: true,
    command: "openDoor",
    url,
    data: r.buffer.toString("utf8"),
    error: "",
  };
}

module.exports = { openDoor };