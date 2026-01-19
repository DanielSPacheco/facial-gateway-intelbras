const express = require("express");

function isAllowedPath(p) {
  return typeof p === "string" && p.startsWith("/mnt/appdata1/userpic/");
}

module.exports = function fileRoutes(cfg) {
  const router = express.Router();

  // GET /facial/file?ip=192.168.3.227&path=/mnt/appdata1/userpic/SnapShot/...
  router.get("/file", async (req, res) => {
    try {
      const ip = String(req.query.ip || "").trim();
      const path = String(req.query.path || "").trim();

      if (!ip) return res.status(400).json({ ok: false, error: "IP_REQUIRED" });
      if (!isAllowedPath(path)) return res.status(400).json({ ok: false, error: "INVALID_PATH" });

      const targetUrl = `http://${ip}${path}`;
      const r = await fetch(targetUrl);

      if (!r.ok) {
        const txt = await r.text().catch(() => "");
        return res.status(502).json({
          ok: false,
          error: "DEVICE_FETCH_FAILED",
          status: r.status,
          targetUrl,
          body: txt.slice(0, 300),
        });
      }

      // repassa o content-type (geralmente image/jpeg)
      res.setHeader("Content-Type", r.headers.get("content-type") || "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=60");

      const buf = Buffer.from(await r.arrayBuffer());
      return res.status(200).send(buf);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "INTERNAL_ERROR", detail: String(e) });
    }
  });

  return router;
};