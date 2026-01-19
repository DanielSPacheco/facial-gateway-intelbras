const express = require("express");
const { assignCard, removeCard } = require("../services/cards.service");

module.exports = (cfg) => {
  const router = express.Router();

  // POST /facial/card/add
  router.post("/add", async (req, res) => {
    try {
      const { userID, cardNo } = req.body || {};
      if (!userID || !cardNo) {
        return res.status(400).json({
          ok: false,
          error: "Campos obrigatórios: userID, cardNo",
          example: { userID: "111", cardNo: "1111101010" },
        });
      }

      // ✅ passa o body inteiro para permitir target
      const r = await assignCard(cfg, req.body || {});
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  // POST /facial/card/delete
  // body: { cardNo: "...", target?: {...} }
  router.post("/delete", async (req, res) => {
    try {
      const { cardNo } = req.body || {};
      if (!cardNo) {
        return res.status(400).json({
          ok: false,
          error: "Campo obrigatório: cardNo",
          example: { cardNo: "1111101010" },
        });
      }

      // ✅ passa o body inteiro para permitir target
      const r = await removeCard(cfg, req.body || {});
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  return router;
};