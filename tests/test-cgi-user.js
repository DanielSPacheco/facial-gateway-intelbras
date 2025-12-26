const { spawn } = require("child_process");
require("dotenv").config();

const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;

function runCurl({ method = "GET", url, body = null }) {
  return new Promise((resolve) => {
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

    if (body) {
      args.push("-H", "Content-Type: application/json");
      args.push("--data-binary", "@-");
    }

    console.log(`📞 ${method} ${url}`);
    if (body) console.log("📦 Body:", JSON.stringify(body, null, 2));

    const child = spawn("curl", args);
    let out = "";
    let err = "";

    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", () => {
      const match = out.match(/HTTP_CODE:(\d{3})/);
      const httpCode = match ? Number(match[1]) : null;
      const stdout = out.replace(/\nHTTP_CODE:\d{3}\n?/, "").trim();

      resolve({
        ok: httpCode >= 200 && httpCode < 300,
        httpCode,
        stdout,
        stderr: err.trim(),
      });
    });

    if (body) {
      child.stdin.write(JSON.stringify(body));
      child.stdin.end();
    }
  });
}

async function testCGIEndpoints() {
  console.log("====================================");
  console.log("🔍 TESTANDO ENDPOINTS CGI");
  console.log("====================================\n");

  const baseUrl = `http://${FACIAL_IP}`;
  const userID = "3000";
  const userName = "Teste CGI";

  // Lista de possíveis endpoints CGI
  const endpoints = [
    {
      name: "userManager.cgi (insert)",
      url: `${baseUrl}/cgi-bin/userManager.cgi?action=insert&user.UserID=${userID}&user.UserName=${encodeURIComponent(userName)}`,
      method: "GET",
    },
    {
      name: "userManager.cgi (insertUser)",
      url: `${baseUrl}/cgi-bin/userManager.cgi?action=insertUser&UserID=${userID}&UserName=${encodeURIComponent(userName)}`,
      method: "GET",
    },
    {
      name: "AccessUser.cgi (insert)",
      url: `${baseUrl}/cgi-bin/AccessUser.cgi?action=insert&UserID=${userID}&UserName=${encodeURIComponent(userName)}`,
      method: "GET",
    },
    {
      name: "AccessControl.cgi (insertUser)",
      url: `${baseUrl}/cgi-bin/AccessControl.cgi?action=insertUser&UserID=${userID}&UserName=${encodeURIComponent(userName)}`,
      method: "GET",
    },
    {
      name: "configManager.cgi (setConfig - AccessUser)",
      url: `${baseUrl}/cgi-bin/configManager.cgi?action=setConfig&AccessUser[0].UserID=${userID}&AccessUser[0].UserName=${encodeURIComponent(userName)}`,
      method: "GET",
    },
  ];

  console.log(`🎯 Tentando criar usuário: ${userID} - ${userName}\n`);

  for (const endpoint of endpoints) {
    console.log(`\n📍 Testando: ${endpoint.name}`);
    console.log(`   ${endpoint.url}`);

    const result = await runCurl({
      method: endpoint.method,
      url: endpoint.url,
      body: endpoint.body,
    });

    console.log(`   ✓ HTTP: ${result.httpCode}`);
    console.log(`   ✓ Response: ${result.stdout.slice(0, 200)}`);

    if (result.ok && result.stdout.includes("OK")) {
      console.log(`\n✅ SUCESSO! Endpoint funcional: ${endpoint.name}`);
      console.log(`   Use este endpoint na API!`);
      return;
    }

    // Aguarda um pouco entre requisições
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\n❌ Nenhum endpoint CGI funcionou para criar usuário");
  console.log("💡 Talvez seja necessário usar RPC2 mesmo (com sessão válida)");
}

testCGIEndpoints().catch(console.error);