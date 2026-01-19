const express = require("express");
const { openDoor } = require("../services/door.service");

module.exports = (cfg) => {
  const router = express.Router();

  // POST /facial/door/open
  // body: { target?: {...}, channel?: "1" }
  router.post("/open", async (req, res) => {
    try {
      const result = await openDoor(cfg, req.body || {});
      res.status(result.ok ? 200 : 500).json(result);
    } catch (e) {
      res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  return router;
};