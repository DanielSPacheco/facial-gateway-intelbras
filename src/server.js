const express = require("express");
const cors = require("cors");

const { getConfig } = require("./config/env");

const doorRoutes = require("./routes/door.routes");
const cardsRoutes = require("./routes/cards.routes");
const faceRoutes = require("./routes/face.routes");
const usersRoutes = require("./routes/users.routes");
const rpcRoutes = require("./routes/rpc.routes"); // <-- ADD AQUI

function startServer() {
  const cfg = getConfig();
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "6mb" })); // base64 / uploads
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/facial/door", doorRoutes(cfg));
  app.use("/facial/card", cardsRoutes(cfg));
  app.use("/facial/face", faceRoutes(cfg));
  app.use("/facial/user", usersRoutes(cfg));

  // ✅ ADD AQUI (depois do app existir)
  app.use("/facial/rpc", rpcRoutes(cfg));

  app.listen(cfg.PORT, () => {
    console.log("====================================");
    console.log("🚪 FACIAL GATEWAY STARTED");
    console.log("PORT:", cfg.PORT);
    console.log("FACIAL_IP:", cfg.FACIAL_IP);
    console.log("CHANNEL:", cfg.FACIAL_CHANNEL);
    console.log("====================================");
  });
}

module.exports = { startServer };