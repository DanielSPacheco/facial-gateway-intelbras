const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "20mb" }));

const PORT = Number(process.env.PORT || 3000);
const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;
const FACIAL_CHANNEL = String(process.env.FACIAL_CHANNEL || "1");

if (!FACIAL_IP || !FACIAL_USER || !FACIAL_PASS) {
  console.error("❌ Falta configurar .env (FACIAL_IP, FACIAL_USER, FACIAL_PASS)");
  process.exit(1);
}

const baseUrl = `http://${FACIAL_IP}`;

function runCurl({ method = "GET", path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    const args = [
      "-sS",
      "--digest",
      "-u",
      `${FACIAL_USER}:${FACIAL_PASS}`,
      "-X",
      method,
      url,
      "-w",
      "\nHTTP_CODE:%{http_code}\n",
    ];

    for (const [k, v] of Object.entries(headers || {})) {
      args.push("-H", `${k}: ${v}`);
    }

    if (body !== null && body !== undefined) {
      args.push("--data-binary", "@-");
    }

    const child = spawn("curl", args, { shell: true });

    let out = "";
    let err = "";

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (code) => {
      const match = out.match(/HTTP_CODE:(\d{3})/);
      const httpCode = match ? Number(match[1]) : null;

      const cleaned = out.replace(/\nHTTP_CODE:\d{3}\n?/, "");

      resolve({
        ok: httpCode ? httpCode >= 200 && httpCode < 300 : false,
        httpCode,
        stdout: cleaned,
        stderr: err,
        exitCode: code,
        url,
        method,
      });
    });

    if (body !== null && body !== undefined) {
      const dataToSend = typeof body === "string" ? body : JSON.stringify(body);
      child.stdin.write(dataToSend);
      child.stdin.end();
    }
  });
}

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "FACIAL GATEWAY ONLINE (curl --digest)",
    config: { facialIp: FACIAL_IP, channel: FACIAL_CHANNEL, user: FACIAL_USER },
    routes: [
      "GET /",
      "GET /health",
      "POST /facial/door/open",
      "GET /facial/deviceInfo",
      "POST /facial/raw",
    ],
  });
});

app.get("/health", (req, res) => res.json({ ok: true }));

/**
 * ABRIR PORTA (DIGEST via curl)
 */
app.post("/facial/door/open", async (req, res) => {
  const path = `/cgi-bin/accessControl.cgi?action=openDoor&channel=${encodeURIComponent(
    FACIAL_CHANNEL
  )}`;

  const r = await runCurl({ method: "GET", path });

  return res.status(r.ok ? 200 : 502).json({
    message: r.ok ? "command_sent" : "command_failed",
    command: "openDoor",
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 2000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

/**
 * DEVICE INFO (pra mapear)
 */
app.get("/facial/deviceInfo", async (req, res) => {
  const r = await runCurl({ method: "GET", path: "/ISAPI/System/deviceInfo" });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    httpCode: r.httpCode,
    url: r.url,
    data: (r.stdout || "").slice(0, 5000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

/**
 * RAW (testar qualquer endpoint do facial)
 * body: { method, path, headers, body }
 */
app.post("/facial/raw", async (req, res) => {
  const { method, path, headers, body } = req.body || {};
  if (!path) return res.status(400).json({ ok: false, error: "Faltou 'path'" });

  const r = await runCurl({ method: method || "GET", path, headers, body });

  return res.status(r.ok ? 200 : 502).json({
    ok: r.ok,
    httpCode: r.httpCode,
    url: r.url,
    method: r.method,
    data: (r.stdout || "").slice(0, 8000),
    error: (r.stderr || "").slice(0, 2000),
  });
});

app.use((req, res) => res.status(404).json({ ok: false, error: "ROTA NÃO EXISTE", path: req.path }));

app.listen(PORT, "0.0.0.0", () => {
  console.log("====================================");
  console.log("🚀 FACIAL GATEWAY INICIADO (curl)");
  console.log(`📍 http://localhost:${PORT}`);
  console.log(`🎯 FACIAL: ${FACIAL_IP} | channel=${FACIAL_CHANNEL} | user=${FACIAL_USER}`);
  console.log("====================================");
});