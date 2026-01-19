const { runCurlDigestBuffer } = require("../clients/cgi.client");
const { resolveTarget } = require("../utils/target.util");

async function getSnapshotJpeg(cfg, bodyOrPayload = {}) {
  const tcfg = resolveTarget(cfg, bodyOrPayload);

  const ch = String(bodyOrPayload.channel || tcfg.FACIAL_CHANNEL || "1");

  if (!tcfg.FACIAL_IP || !tcfg.FACIAL_USER || !tcfg.FACIAL_PASS) {
    return {
      ok: false,
      error: "CONFIG_ERROR",
      message: "Missing FACIAL_IP / FACIAL_USER / FACIAL_PASS",
    };
  }

  const url = `http://${tcfg.FACIAL_IP}/cgi-bin/snapshot.cgi?channel=${encodeURIComponent(ch)}`;

  const r = await runCurlDigestBuffer({
    url,
    user: tcfg.FACIAL_USER,
    pass: tcfg.FACIAL_PASS,
    timeoutMs: tcfg.TIMEOUT_MS || 15000,
  });

  if (!r.ok) {
    return {
      ok: false,
      error: "FETCH_ERROR",
      message: "curl digest failed",
      details: { code: r.code, stderr: r.stderr, url: r.url },
    };
  }

  if (!r.buffer || r.buffer.length < 2 || r.buffer[0] !== 0xff || r.buffer[1] !== 0xd8) {
    return {
      ok: false,
      error: "INVALID_IMAGE",
      message: "Response is not a JPEG",
      details: {
        url,
        sample: r.buffer ? r.buffer.slice(0, 80).toString("utf8") : null,
        stderr: r.stderr,
      },
    };
  }

  return { ok: true, jpeg: r.buffer };
}

module.exports = { getSnapshotJpeg };