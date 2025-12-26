const express = require("express");
const { getUser, createUser, updateUser, deleteUser } = require("../services/users.service");

module.exports = (cfg) => {
  const router = express.Router();

  router.get("/:userID", async (req, res) => {
    const r = await getUser(cfg, req.params.userID);
    res.json(r);
  });

  router.post("/create", async (req, res) => {
    const { userID, userName, password, authority } = req.body || {};
    if (!userID || !userName || !password) {
      return res.status(400).json({
        ok: false,
        error: "Campos obrigatórios: userID, userName, password",
        example: { userID: "888", userName: "Joao", password: "1234", authority: 2 },
      });
    }
    const r = await createUser(cfg, { userID, userName, password, authority });
    return res.status(r.ok ? 200 : 502).json(r);
  });

  router.post("/update", async (req, res) => {
    const { userID, userName } = req.body || {};
    if (!userID || !userName) {
      return res.status(400).json({
        ok: false,
        error: "Campos obrigatórios: userID, userName",
        example: { userID: "888", userName: "Usuario 888 RENOMEADO" },
      });
    }
    const r = await updateUser(cfg, { userID, userName });
    return res.status(r.ok ? 200 : 502).json(r);
  });

  router.post("/delete", async (req, res) => {
    const { userID } = req.body || {};
    if (!userID) {
      return res.status(400).json({ ok: false, error: "Campos obrigatórios: userID", example: { userID: "888" } });
    }
    const r = await deleteUser(cfg, { userID });
    return res.status(r.ok ? 200 : 502).json(r);
  });

  return router;
};