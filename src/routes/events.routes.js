const express = require("express");
const { listEvents } = require("../services/events.service");
const { fetchEventPhoto } = require("../services/eventsPhoto.service");

module.exports = (cfg) => {
  const router = express.Router();

  // ============================================================
  // LISTA EVENTOS
  // GET /facial/events/:deviceId?from=ISO&to=ISO&limit=50&offset=0
  // ============================================================
  router.get("/:deviceId", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;

      const from = req.query.from || null;
      const to = req.query.to || null;

      const limit = req.query.limit !== undefined ? Number(req.query.limit) : 50;
      const offset = req.query.offset !== undefined ? Number(req.query.offset) : 0;

      // Base absoluta do gateway (pra montar photo_url no service)
      const gatewayBaseUrl = `${req.protocol}://${req.get("host")}`;

      const result = await listEvents(cfg, {
        deviceId,
        from,
        to,
        limit,
        offset,
        gatewayBaseUrl,
      });

      if (!result?.ok) {
        return res.status(502).json({
          ok: false,
          error: result?.error || "FETCH_ERROR",
          message: result?.message || "Falha ao buscar eventos",
          details: result?.details || null,
          raw: result?.raw || null,
        });
      }

      return res.status(200).json(result);

    } catch (err) {
      console.error("[EVENTS] error:", err);

      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: err?.message || "Erro inesperado",
      });
    }
  });

  // ============================================================
  // FOTO REAL DO EVENTO (RPC2_Loadfile)
  // GET /facial/events/:deviceId/photo?url=/mnt/...jpg
  // ============================================================
  router.get("/:deviceId/photo", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const urlPath = req.query.url ? String(req.query.url) : null;

      if (!urlPath) {
        return res.status(400).json({
          ok: false,
          error: "MISSING_URL",
          message: "Parâmetro 'url' é obrigatório",
        });
      }

      const result = await fetchEventPhoto(cfg, {
        deviceId,
        urlPath,
      });

      if (!result.ok) {
        return res.status(502).json({
          ok: false,
          error: result.error,
          message: result.message,
          details: result.details || null,
        });
      }

      // Headers corretos para imagem
      res.setHeader("Content-Type", result.contentType || "image/jpeg");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      return res.status(200).send(result.bytes);

    } catch (err) {
      console.error("[EVENT PHOTO] error:", err);

      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: err?.message || "Erro inesperado",
      });
    }
  });

  return router;
};