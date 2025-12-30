const express = require("express");
const { rpc2Login, rpc2Call } = require("../clients/rpc2.client");

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

      // 1) Login RPC2 (session válida)
      const session = await rpc2Login({
        ip: cfg.FACIAL_IP,
        user: cfg.FACIAL_USER,
        pass: cfg.FACIAL_PASS,
        timeoutMs: cfg.TIMEOUT_MS,
      });

      // 2) Inserir cartão (TAG)
      const r = await rpc2Call({
        ip: cfg.FACIAL_IP,
        session,
        method: "AccessCard.insertMulti",
        params: {
          CardList: [
            {
              CardNo: String(cardNo),
              UserID: String(userID),
            },
          ],
        },
        id: 3100,
        timeoutMs: cfg.TIMEOUT_MS,
      });

      if (r?.result !== true) {
        return res.status(500).json({
          ok: false,
          error: r?.error || { message: "assign_card_failed" },
          raw: r,
        });
      }

      return res.json({
        ok: true,
        assigned: true,
        method: "AccessCard.insertMulti",
        userID: String(userID),
        cardNo: String(cardNo),
      });
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  // POST /facial/card/delete
  // body: { cardNo: "3333333333333333" }
  router.post("/delete", async (req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED_YET",
      hint: "Depois a gente implementa o remove (método varia por firmware).",
    });
  });

  return router;
};