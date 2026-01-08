const express = require("express");
const multer = require("multer");
const { uploadFace } = require("../services/face.service");

module.exports = (cfg) => {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB input
  });

  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      const userID = req.body?.userID;
      const file = req.file;

      if (!userID) {
        return res.status(400).json({
          ok: false,
          error: "Campos obrigatórios: userID",
          example: { userID: "002" },
        });
      }

      if (!file?.buffer) {
        return res.status(400).json({
          ok: false,
          error: "Envie um arquivo em form-data no campo 'file'",
          example: "file=@/caminho/foto.jpg",
        });
      }

      const r = await uploadFace(cfg, { userID, imageBuffer: file.buffer });

      if (!r.ok) {
        const status = r.error?.code === "IMAGE_TOO_LARGE" ? 413 : 502;
        return res.status(status).json(r);
      }

      return res.json(r);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "INTERNAL_ERROR",
        message: e?.message || "Erro inesperado",
      });
    }
  });

  return router;
};