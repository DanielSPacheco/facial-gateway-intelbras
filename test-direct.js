const { spawn } = require("child_process");
require("dotenv").config();

const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;

console.log("====================================");
console.log("🧪 TESTE DIRETO (usando seu .env)");
console.log("====================================");
console.log(`📍 IP: ${FACIAL_IP}`);
console.log(`👤 User: ${FACIAL_USER}`);
console.log("====================================\n");

// Vamos testar com a mesma função que você já usa no index.js
function runCurl({ method = "GET", path, headers = {}, body = null }) {
  return new Promise((resolve) => {
    const url = `http://${FACIAL_IP}${path.startsWith("/") ? "" : "/"}${path}`;

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

async function testarEndpoints() {
  console.log("🔍 Teste 1: Abertura de porta (já funciona)\n");
  
  const r1 = await runCurl({ 
    method: "GET", 
    path: "/cgi-bin/accessControl.cgi?action=openDoor&channel=1" 
  });
  
  console.log(`   Status: ${r1.httpCode}`);
  console.log(`   OK: ${r1.ok}`);
  console.log(`   Resposta: ${r1.stdout.slice(0, 200)}\n`);

  console.log("=".repeat(60));
  console.log("🔍 Teste 2: Device Info\n");
  
  const r2 = await runCurl({ 
    method: "GET", 
    path: "/ISAPI/System/deviceInfo" 
  });
  
  console.log(`   Status: ${r2.httpCode}`);
  console.log(`   OK: ${r2.ok}`);
  console.log(`   Resposta: ${r2.stdout.slice(0, 300)}\n`);

  console.log("=".repeat(60));
  console.log("🔍 Teste 3: Listar usuários (CGI)\n");
  
  const r3 = await runCurl({ 
    method: "GET", 
    path: "/cgi-bin/userManager.cgi?action=getUserInfoAll" 
  });
  
  console.log(`   Status: ${r3.httpCode}`);
  console.log(`   OK: ${r3.ok}`);
  console.log(`   Resposta: ${r3.stdout.slice(0, 300)}\n`);

  console.log("=".repeat(60));
  console.log("🔍 Teste 4: Capabilities de usuário (ISAPI)\n");
  
  const r4 = await runCurl({ 
    method: "GET", 
    path: "/ISAPI/AccessControl/UserInfo/Capabilities" 
  });
  
  console.log(`   Status: ${r4.httpCode}`);
  console.log(`   OK: ${r4.ok}`);
  console.log(`   Resposta: ${r4.stdout.slice(0, 300)}\n`);

  console.log("=".repeat(60));
  console.log("🔍 Teste 5: Search de usuários (POST)\n");
  
  const r5 = await runCurl({ 
    method: "POST", 
    path: "/ISAPI/AccessControl/UserInfo/Search?format=json",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      UserInfoSearchCond: {
        searchID: "1",
        searchResultPosition: 0,
        maxResults: 10
      }
    })
  });
  
  console.log(`   Status: ${r5.httpCode}`);
  console.log(`   OK: ${r5.ok}`);
  console.log(`   Resposta: ${r5.stdout.slice(0, 500)}\n`);

  console.log("=".repeat(60));
  console.log("\n📊 RESUMO:\n");
  
  const results = [
    { nome: "Abertura porta", status: r1.httpCode, ok: r1.ok },
    { nome: "Device Info", status: r2.httpCode, ok: r2.ok },
    { nome: "Listar users CGI", status: r3.httpCode, ok: r3.ok },
    { nome: "Capabilities ISAPI", status: r4.httpCode, ok: r4.ok },
    { nome: "Search users POST", status: r5.httpCode, ok: r5.ok },
  ];
  
  results.forEach(r => {
    const icon = r.ok ? "✅" : "❌";
    console.log(`${icon} ${r.nome}: HTTP ${r.status}`);
  });
  
  console.log("\n" + "=".repeat(60));
}

testarEndpoints().catch(console.error);