const { spawn } = require("child_process");

function runCurlDigest({ baseUrl, path, user, pass, method = "GET", timeoutMs = 15000, body = null }) {
  return new Promise((resolve) => {
    const url = `${baseUrl}${path}`;
    const args = [
      "-sS",
      "--digest",
      "-u",
      `${user}:${pass}`,
      "-X",
      method,
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      url,
    ];

    // Se enviar body, manda content-type json por padrão
    if (body !== null && body !== undefined) {
      args.splice(args.length - 1, 0, "-H", "Content-Type: application/json");
      args.splice(args.length - 1, 0, "--data-binary", "@-");
    }

    const child = spawn("curl", args);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        httpCode: code === 0 ? 200 : 0, // curl não retorna http code sem -w; mantemos simples
        url,
        stdout,
        stderr,
        code,
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