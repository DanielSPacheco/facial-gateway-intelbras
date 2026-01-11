const { runCurlDigestBuffer } = require("../clients/cgi.client");

/**
 * Retorna JPEG (Buffer) do snapshot do facial
 * - Por enquanto: usa cfg.FACIAL_IP/USER/PASS (ENV do gateway)
 * - Depois: podemos evoluir para resolver por deviceId no DB
 */
async function getSnapshotJpeg(cfg, { deviceId, channel }) {
  const ip = cfg.FACIAL_IP;
  const user = cfg.FACIAL_USER;
  const pass = cfg.FACIAL_PASS;

  const ch = String(channel || cfg.FACIAL_CHANNEL || "1");

  if (!ip || !user || !pass) {
    return {
      ok: false,
      error: "CONFIG_ERROR",
      message: "Missing FACIAL_IP / FACIAL_USER / FACIAL_PASS",
    };
  }

  const url = `http://${ip}/cgi-bin/snapshot.cgi?channel=${encodeURIComponent(ch)}`;

  const r = await runCurlDigestBuffer({
    url,
    user,
    pass,
    timeoutMs: cfg.TIMEOUT_MS || 15000,
  });

  if (!r.ok) {
    return {
      ok: false,
      error: "FETCH_ERROR",
      message: "curl digest failed",
      details: { code: r.code, stderr: r.stderr, url: r.url },
    };
  }

  // valida assinatura JPEG (0xFF 0xD8)
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