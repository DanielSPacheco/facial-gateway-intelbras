const express = require("express");
const { getEvents } = require("../services/events.service");
const { mapDeviceEventToAuditRow } = require("../utils/audit.mapper");

module.exports = (cfg) => {
  const router = express.Router();

  /**
   * GET /audit/access/:deviceId?from=...&to=...&limit=...&offset=...
   * (vai funcionar com base "" e "/facial")
   */
  router.get("/audit/access/:deviceId", async (req, res) => {
    try {
      const { deviceId } = req.params;

      const r = await getEvents(cfg, {
        deviceId,
        from: req.query.from,
        to: req.query.to,
        limit: req.query.limit,
        offset: req.query.offset,
      });

      if (!r.ok) return res.status(502).json(r);

      const records = (r.records || []).map((ev) =>
        mapDeviceEventToAuditRow(deviceId, ev)
      );

      return res.json({
        ok: true,
        deviceId,
        total: records.length,
        records,
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: e?.message || String(e),
      });
    }
  });

  return router;
};