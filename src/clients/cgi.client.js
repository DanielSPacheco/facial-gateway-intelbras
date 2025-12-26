const { spawn } = require("child_process");

function runCurlDigest({ baseUrl, user, pass, timeoutMs, method = "GET", path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

    const args = [
      "-sS",
      "--digest",
      "-u",
      `${user}:${pass}`,
      "--max-time",
      String(Math.ceil((timeoutMs || 15000) / 1000)),
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

    // CRÍTICO: shell:false (pra não quebrar o "&channel=1" no Windows)
    const child = spawn("curl", args, { shell: false });

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

module.exports = { runCurlDigest };