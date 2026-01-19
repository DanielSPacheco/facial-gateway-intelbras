require("dotenv").config();

const express = require("express");
const cors = require("cors");

const { getConfig } = require("./config/env");

// rotas (factory)
const usersRoutes = require("./routes/users.routes");
const doorRoutes = require("./routes/door.routes");
const snapshotRoutes = require("./routes/snapshot.routes");
const rpcRoutes = require("./routes/rpc.routes");
const faceRoutes = require("./routes/face.routes");
const eventsRoutes = require("./routes/events.routes");
const cardsRoutes = require("./routes/cards.routes");
const auditRoutes = require("./routes/audit.routes");
const fileRoutes = require("./routes/file.routes");

function startServer() {
  const cfg = getConfig();

  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/health", (req, res) => {
    res.json({
      ok: true,
      service: "facial-gateway-intelbras",
      time: new Date().toISOString(),
    });
  });

  const bases = ["", "/facial"];

  for (const base of bases) {
    app.use(`${base}/user`, usersRoutes(cfg));
    app.use(`${base}/door`, doorRoutes(cfg));
    app.use(`${base}/rpc`, rpcRoutes(cfg));
    app.use(`${base}/face`, faceRoutes(cfg));
    app.use(`${base}/events`, eventsRoutes(cfg));
    app.use(`${base}/card`, cardsRoutes(cfg));
    app.use(`${base}`, fileRoutes(cfg));


    // snapshotRoutes tem GET "/:deviceId/snapshot"
    // então precisa montar em `${base}`:
    app.use(`${base}`, snapshotRoutes(cfg));

    // auditoria (nova)
    // rota interna é "/audit/access/:deviceId"
    app.use(`${base}`, auditRoutes(cfg));
  }

  app.use((req, res) => {
    res.status(404).json({
      ok: false,
      error: "ROUTE_NOT_FOUND",
      method: req.method,
      path: req.path,
    });
  });

  app.listen(cfg.PORT, () => {
    console.log("====================================");
    console.log("🚪 FACIAL GATEWAY STARTED");
    console.log("PORT:", cfg.PORT);
    console.log("FACIAL_IP:", cfg.FACIAL_IP);
    console.log("FACIAL_CHANNEL:", cfg.FACIAL_CHANNEL);
    console.log("TIMEOUT_MS:", cfg.TIMEOUT_MS);
    console.log("====================================");
  });

  return app;
}

module.exports = { startServer };