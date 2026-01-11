const { spawn } = require("child_process");

function runCurlDigestBuffer({
  url,
  user,
  pass,
  timeoutMs = 15000,
}) {
  return new Promise((resolve) => {
    const args = [
      "-sS",
      "--digest",
      "-u",
      `${user}:${pass}`,
      "--max-time",
      String(Math.ceil(timeoutMs / 1000)),
      url,
    ];

    const child = spawn("curl", args);

    const chunks = [];
    let stderr = "";

    child.stdout.on("data", (d) => chunks.push(d)); // Buffer chunks
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("close", (code) => {
      const buffer = Buffer.concat(chunks);

      resolve({
        ok: code === 0,
        code,
        url,
        buffer,
        stderr,
      });
    });
  });
}

module.exports = { runCurlDigestBuffer };