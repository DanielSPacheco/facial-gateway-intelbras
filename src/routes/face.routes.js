const express = require("express");

module.exports = (cfg) => {
  const router = express.Router();

  router.post("/upload", async (req, res) => {
    return res.status(501).json({
      ok: false,
      error: "NOT_IMPLEMENTED_YET",
      hint: "Face normalmente envolve RPC3_Loadfile + um método RPC2 para associar ao UserID.",
    });
  });

  return router;
};