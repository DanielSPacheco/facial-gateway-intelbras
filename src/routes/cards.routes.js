const express = require("express");
const { assignCard } = require("../services/cards.service");

module.exports = (cfg) => {
  const router = express.Router();

  // POST /facial/card/add
  // body: { userID: "001", cardNo: "3333333333333333" }
  router.post("/add", async (req, res) => {
    try {
      const { userID, cardNo } = req.body || {};

      if (!userID || !cardNo) {
        return res.status(400).json({
          ok: false,
          error: "Campos obrigatórios: userID, cardNo",
          example: { userID: "001", cardNo: "3333333333333333" },
        });
      }

      const r = await assignCard(cfg, { userID, cardNo });
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  // POST /facial/card/delete (stub)
  router.post("/delete", async (_req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED_YET",
      hint: "Depois a gente implementa o remove (método varia por firmware).",
    });
  });

  return router;
};