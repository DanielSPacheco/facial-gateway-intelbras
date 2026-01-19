const express = require("express");
const { getSnapshotJpeg } = require("../services/snapshot.service");

module.exports = (cfg) => {
  const router = express.Router();

  function parseTargetFromQuery(q) {
    if (!q) return null;

    // 1) ?target={...} (urlencoded)
    if (typeof q.target === "string") {
      try {
        return JSON.parse(q.target);
      } catch {}
    }

    // 2) ?ip=...&user=...&pass=...&channel=...
    if (q.ip && q.user && q.pass) {
      return {
        ip: String(q.ip),
        user: String(q.user),
        pass: String(q.pass),
        channel: q.channel !== undefined ? q.channel : undefined,
        timeoutMs: q.timeoutMs !== undefined ? Number(q.timeoutMs) : undefined,
      };
    }

    return null;
  }

  async function handler(req, res) {
    try {
      const deviceId = req.params.deviceId;
      const channel = req.query.channel || cfg.FACIAL_CHANNEL || "1";
      const target = parseTargetFromQuery(req.query);

      const r = await getSnapshotJpeg(cfg, {
        deviceId,
        channel,
        ...(target ? { target } : {}),
      });

      if (!r.ok) {
        return res.status(502).json({
          ok: false,
          error: r.error || "FETCH_ERROR",
          message: r.message || "Snapshot failed",
          details: r.details || null,
        });
      }

      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      return res.status(200).send(r.jpeg);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: e?.message || "Erro inesperado",
      });
    }
  }

  /**
   *  Rota principal
   * GET /facial/:deviceId/snapshot?channel=1
   * opcional: target via query (?target=... OU ip/user/pass)
   */
  router.get("/:deviceId/snapshot", handler);

  /**
   * Rota alternativa (pra compatibilidade com front/old paths)
   * Montar em server.js:
   *   app.use(`${base}/snapshot`, snapshotRoutes(cfg))
   * então vira:
   *   GET /facial/snapshot/:deviceId?channel=1
   */
  router.get("/:deviceId", handler);

  return router;
};