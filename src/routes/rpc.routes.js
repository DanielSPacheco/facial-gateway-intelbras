const express = require("express");
const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

module.exports = (cfg) => {
  const router = express.Router();

  // POST /facial/rpc/listMethods
  router.post("/listMethods", async (_req, res) => {
    try {
      const session = await rpc2Login({
        ip: cfg.FACIAL_IP,
        user: cfg.FACIAL_USER,
        pass: cfg.FACIAL_PASS,
        timeoutMs: cfg.TIMEOUT_MS,
      });

      // Alguns firmwares suportam system.listMethods
      const r = await rpc2Call({
        ip: cfg.FACIAL_IP,
        session,
        method: "system.listMethods",
        params: {},
        id: 9001,
        timeoutMs: cfg.TIMEOUT_MS,
      });

      return res.status(r?.result ? 200 : 502).json({ ok: r?.result === true, raw: r });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", details: e?.message || String(e) });
    }
  });

  // POST /facial/rpc/call (debug controlado)
  router.post("/call", async (req, res) => {
    try {
      const { method, params, id } = req.body || {};
      if (!method) return res.status(400).json({ ok: false, error: "Missing method" });

      const session = await rpc2Login({
        ip: cfg.FACIAL_IP,
        user: cfg.FACIAL_USER,
        pass: cfg.FACIAL_PASS,
        timeoutMs: cfg.TIMEOUT_MS,
      });

      const r = await rpc2Call({
        ip: cfg.FACIAL_IP,
        session,
        method,
        params: params || {},
        id: id || 9002,
        timeoutMs: cfg.TIMEOUT_MS,
      });

      return res.status(r?.result ? 200 : 502).json({ ok: r?.result === true, raw: r });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", details: e?.message || String(e) });
    }
  });

  return router;
};
