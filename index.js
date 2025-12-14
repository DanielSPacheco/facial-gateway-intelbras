const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;
const FACIAL_CHANNEL = process.env.FACIAL_CHANNEL || "1";

const BASE_URL = `http://${FACIAL_IP}`;

function runCurlOpenDoor() {
  return new Promise((resolve) => {
    const args = [
      "-sS",
      "--digest",
      "-u",
      `${FACIAL_USER}:${FACIAL_PASS}`,
      "--get",
      "-d",
      "action=openDoor",
      "-d",
      `channel=${FACIAL_CHANNEL}`,
      BASE_URL + "/cgi-bin/accessControl.cgi",
      "-w",
      "\nHTTP_CODE:%{http_code}\n",
    ];

    const child = spawn("curl", args, { shell: false });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", () => {
      const match = stdout.match(/HTTP_CODE:(\d{3})/);
      const httpCode = match ? Number(match[1]) : null;

      resolve({
        ok: httpCode >= 200 && httpCode < 300,
        httpCode,
        data: stdout.replace(/\nHTTP_CODE:\d{3}/, "").trim(),
        error: stderr.trim(),
      });
    });
  });
}

/**
 * ROOT
 */
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "FACIAL GATEWAY ONLINE (Windows-safe)",
    routes: ["POST /facial/door/open"],
  });
});

/**
 * ABRIR PORTA
 */
app.post("/facial/door/open", async (req, res) => {
  const r = await runCurlOpenDoor();

  return res.status(r.ok ? 200 : 502).json({
    message: r.ok ? "command_sent" : "command_failed",
    command: "openDoor",
    httpCode: r.httpCode,
    data: r.data,
    error: r.error,
  });
});

app.listen(PORT, () => {
  console.log("====================================");
  console.log("🚀 FACIAL GATEWAY INICIADO");
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎯 FACIAL: ${FACIAL_IP}`);
  console.log("====================================");
});