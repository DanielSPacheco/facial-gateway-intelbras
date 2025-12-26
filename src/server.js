const express = require("express");
const cors = require("cors");
const { getConfig } = require("./config/env");

const doorRoutes = require("./routes/door.routes");
const usersRoutes = require("./routes/users.routes");
const cardsRoutes = require("./routes/cards.routes");
const faceRoutes = require("./routes/face.routes");

function startServer() {
  const cfg = getConfig();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/", (req, res) => {
    res.json({
      ok: true,
      name: "facial-gateway",
      config: { ip: cfg.FACIAL_IP, channel: cfg.FACIAL_CHANNEL },
      routes: {
        door: ["/facial/door/open"],
        users: [
          "GET /facial/user/:userID",
          "POST /facial/user/create",
          "POST /facial/user/update",
          "POST /facial/user/delete",
        ],
        cards: ["(coming) POST /facial/card/add", "(coming) POST /facial/card/delete"],
        face: ["(coming) POST /facial/face/upload"],
      },
    });
  });

  app.get("/health", (req, res) => res.json({ ok: true }));

  app.use("/facial/door", doorRoutes(cfg));
  app.use("/facial/user", usersRoutes(cfg));
  app.use("/facial/card", cardsRoutes(cfg));
  app.use("/facial/face", faceRoutes(cfg));

  app.use((req, res) =>
    res.status(404).json({ ok: false, error: "ROUTE_NOT_FOUND", path: req.path })
  );

  app.listen(cfg.PORT, "0.0.0.0", () => {
    console.log("====================================");
    console.log("🚀 FACIAL GATEWAY STARTED");
    console.log(`📍 http://localhost:${cfg.PORT}`);
    console.log(`🎯 FACIAL: ${cfg.FACIAL_IP} | channel=${cfg.FACIAL_CHANNEL} | user=${cfg.FACIAL_USER}`);
    console.log("====================================");
  });

  return app;
}

module.exports = { startServer };