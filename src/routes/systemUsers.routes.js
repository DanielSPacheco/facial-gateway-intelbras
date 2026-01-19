const express = require("express");
const { createMember } = require("../services/team.service");

module.exports = () => {
  const router = express.Router();

  router.post("/members", async (req, res) => {
    try {
      const { email, fullName, role, siteId } = req.body || {};
      if (!email || !fullName || !role) {
        return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
      }

      const r = await createMember({ email, fullName, role, siteId });
      return res.json({ ok: true, ...r });
    } catch (e) {
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", message: e?.message || String(e) });
    }
  });

  return router;
};
