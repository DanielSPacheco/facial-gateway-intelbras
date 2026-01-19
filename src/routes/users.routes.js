const express = require("express");
const { getUser, createUser, updateUser, deleteUser } = require("../services/users.service");

module.exports = (cfg) => {
  const router = express.Router();

  router.get("/:userID", async (req, res) => {
    try {
      const r = await getUser(cfg, { userID: req.params.userID });
      return res.json(r);
    } catch (e) {
      console.error("[user.get] error:", e);
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  router.post("/create", async (req, res) => {
    try {
      const { userID, userName } = req.body || {};

      if (!userID || !userName) {
        return res.status(400).json({
          ok: false,
          error: "Campos obrigatórios: userID, userName",
        });
      }

      const r = await createUser(cfg, req.body || {});
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) {
      console.error("[user.create] error:", e);
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  router.post("/update", async (req, res) => {
    try {
      const { userID } = req.body || {};

      if (!userID) {
        return res.status(400).json({
          ok: false,
          error: "Campo obrigatório: userID",
        });
      }

      const r = await updateUser(cfg, req.body || {});
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) {
      console.error("[user.update] error:", e);
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  router.post("/delete", async (req, res) => {
    try {
      const { userID } = req.body || {};

      if (!userID) {
        return res.status(400).json({
          ok: false,
          error: "Campos obrigatórios: userID",
        });
      }

      const r = await deleteUser(cfg, req.body || {});
      return res.status(r.ok ? 200 : 502).json(r);
    } catch (e) {
      console.error("[user.delete] error:", e);
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        details: e?.message || String(e),
      });
    }
  });

  return router;
};
