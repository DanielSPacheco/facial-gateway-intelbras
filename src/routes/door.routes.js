const express = require("express");
const { openDoor } = require("../services/door.service");

module.exports = (cfg) => {
  const router = express.Router();

  router.post("/open", async (req, res) => {
    const r = await openDoor(cfg);
    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok,
      command: "openDoor",
      httpCode: r.httpCode,
      url: r.url,
      data: r.data,
      error: r.error,
    });
  });

  return router;
};