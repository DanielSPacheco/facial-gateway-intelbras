function resolveTarget(cfg, bodyOrQuery = {}) {
  const t =
    bodyOrQuery?.target ||
    bodyOrQuery?.payload?.target ||
    null;

  return {
    FACIAL_IP: t?.ip || cfg.FACIAL_IP,
    FACIAL_CHANNEL: String(t?.channel ?? cfg.FACIAL_CHANNEL ?? "1"),

    // ✅ fallback seguro: se não vier, usa do cfg
    FACIAL_USER: t?.user || cfg.FACIAL_USER,
    FACIAL_PASS: t?.pass || cfg.FACIAL_PASS,

    TIMEOUT_MS: Number(t?.timeoutMs ?? cfg.TIMEOUT_MS ?? 15000),
  };
}

module.exports = { resolveTarget };
