const express = require("express");
const { getSnapshotJpeg } = require("../services/snapshot.service");

module.exports = (cfg) => {
  const router = express.Router();

  /**
   * GET /facial/:deviceId/snapshot?channel=1
   */
  router.get("/:deviceId/snapshot", async (req, res) => {
    try {
      const deviceId = req.params.deviceId;
      const channel = req.query.channel || cfg.FACIAL_CHANNEL || "1";

      const r = await getSnapshotJpeg(cfg, { deviceId, channel });

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
  });

  return router;
};