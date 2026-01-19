const express = require("express");
const multer = require("multer");
const { uploadFaceFile, uploadFaceBase64 } = require("../services/face.service");

module.exports = (cfg) => {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  function parseTargetMaybe(body) {
    if (!body) return null;
    if (body.target && typeof body.target === "object") return body.target;
    if (typeof body.target === "string") {
      try {
        return JSON.parse(body.target);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * POST /facial/face/upload
   * multipart/form-data: userID + file (+ target opcional)
   */
  router.post("/upload", upload.single("file"), async (req, res) => {
    try {
      const userID = req.body?.userID;
      const file = req.file;

      if (!userID) {
        return res.status(400).json({
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Campos obrigatórios: userID",
          example: { userID: "002" },
        });
      }

      if (!file?.buffer) {
        return res.status(400).json({
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Envie um arquivo em form-data no campo 'file'",
          example: "file=@/caminho/foto.jpg",
        });
      }

      const target = parseTargetMaybe(req.body);

      const r = await uploadFaceFile(cfg, {
        userID,
        imageBuffer: file.buffer,
        ...(target ? { target } : {}),
      });

      if (!r.ok) {
        const status =
          r.error === "REQUEST_TOO_LARGE" || r.error === "IMAGE_TOO_LARGE" ? 413 : 502;
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

  /**
   * POST /facial/face/uploadBase64
   * JSON: { userID, photoData, target? }
   */
  router.post("/uploadBase64", async (req, res) => {
    try {
      const userID = req.body?.userID;
      const photoData = req.body?.photoData;

      if (!userID || !photoData) {
        return res.status(400).json({
          ok: false,
          error: "VALIDATION_ERROR",
          message: "Campos obrigatórios: userID, photoData",
          example: { userID: "002", photoData: "<base64>" },
        });
      }

      // passa body inteiro para permitir target
      const r = await uploadFaceBase64(cfg, req.body || {});

      if (!r.ok) {
        const status = r.error === "REQUEST_TOO_LARGE" ? 413 : 502;
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