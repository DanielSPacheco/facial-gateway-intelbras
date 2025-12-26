const express = require("express");

module.exports = (cfg) => {
  const router = express.Router();

  router.post("/add", async (req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED_YET",
      hint: "Vamos implementar com AccessCard.insertMulti / updateMulti assim que você capturar o payload do DevTools.",
    });
  });

  router.post("/delete", async (req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED_YET",
      hint: "Vamos implementar com AccessCard.removeMulti quando cravar o método correto.",
    });
  });

  return router;
};