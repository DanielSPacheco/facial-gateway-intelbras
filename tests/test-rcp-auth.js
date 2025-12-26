const http = require("http");
require("dotenv").config();

const FACIAL_IP = process.env.FACIAL_IP;
const FACIAL_USER = process.env.FACIAL_USER;
const FACIAL_PASS = process.env.FACIAL_PASS;

function rpc2Request({ method, params = {}, auth = null, session = null }) {
  return new Promise((resolve, reject) => {
    const payload = {
      method,
      params,
      id: 1,
    };

    // Adiciona sessão se fornecida
    if (session) {
      payload.session = session;
    }

    const data = JSON.stringify(payload);
    
    const options = {
      hostname: FACIAL_IP,
      port: 80,
      path: "/RPC2",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length,
      },
    };

    // Adiciona autenticação se fornecida
    if (auth) {
      options.headers["Authorization"] = auth;
    }

    console.log(`\n📤 Enviando RPC2...`);
    console.log(`   Method: ${method}`);
    console.log(`   Auth: ${auth || "nenhuma"}`);
    console.log(`   Session: ${session || "nenhuma"}`);

    const req = http.request(options, (res) => {
      let responseData = "";
      
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      
      res.on("end", () => {
        try {
          const json = JSON.parse(responseData);
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: json,
          });
        } catch {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData,
          });
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function testRPC2Auth() {
  console.log("====================================");
  console.log("🔐 TESTANDO AUTENTICAÇÃO RPC2");
  console.log("====================================");

  const testMethods = [
    {
      name: "Sem autenticação",
      auth: null,
      session: null,
    },
    {
      name: "Basic Auth",
      auth: `Basic ${Buffer.from(`${FACIAL_USER}:${FACIAL_PASS}`).toString("base64")}`,
      session: null,
    },
    {
      name: "Basic Auth + Params",
      auth: `Basic ${Buffer.from(`${FACIAL_USER}:${FACIAL_PASS}`).toString("base64")}`,
      session: null,
      addUserPass: true,
    },
    {
      name: "Usuário/senha no params",
      auth: null,
      session: null,
      addUserPass: true,
    },
  ];

  for (const test of testMethods) {
    console.log(`\n${"=".repeat(50)}`);
    console.log(`🧪 Teste: ${test.name}`);
    console.log("=".repeat(50));

    const params = {
      User: {
        UserID: "3000",
        UserName: "Teste RPC2",
        UserType: "User",
      },
    };

    // Adiciona credenciais no params se necessário
    if (test.addUserPass) {
      params.username = FACIAL_USER;
      params.password = FACIAL_PASS;
    }

    try {
      const result = await rpc2Request({
        method: "AccessUser.insert",
        params,
        auth: test.auth,
        session: test.session,
      });

      console.log(`\n📊 HTTP Status: ${result.statusCode}`);
      console.log(`📄 Response:`);
      console.log(JSON.stringify(result.data, null, 2));

      // Verifica se funcionou
      if (result.data?.result === true) {
        console.log(`\n✅ SUCESSO! Este método funciona!`);
        console.log(`   Use: ${test.name}`);
        return;
      }

      // Verifica erros específicos
      if (result.data?.error?.code === 287637505) {
        console.log(`⚠️  Erro de sessão inválida (esperado)`);
      } else if (result.data?.error?.code === 268894210) {
        console.log(`⚠️  Método não existe (esperado)`);
      } else if (result.data?.error) {
        console.log(`⚠️  Erro: ${result.data.error.message} (code: ${result.data.error.code})`);
      }

    } catch (error) {
      console.error(`❌ Erro: ${error.message}`);
    }

    // Aguarda entre testes
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`\n💡 PRÓXIMOS PASSOS:`);
  console.log(`   1. Verificar documentação da API do fabricante`);
  console.log(`   2. Capturar tráfego da Segware com Wireshark`);
  console.log(`   3. Ou criar usuário no painel e só fazer upload de foto via API`);
  console.log(`\n${"=".repeat(50)}`);
}

testRPC2Auth().catch(console.error);