const http = require("http");

const baseUrl = "http://localhost:3000";

function makeRequest(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    
    const options = {
      hostname: "localhost",
      port: 3000,
      path: path,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = "";
      
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          data: JSON.parse(responseData)
        });
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function testCreateUser() {
  console.log("====================================");
  console.log("🧪 TESTE: Criar Usuário no Facial");
  console.log("====================================\n");
  
  const testUser = {
    userID: "3000",
    name: "Teste API"
  };
  
  console.log("📤 Enviando requisição...");
  console.log("   userID:", testUser.userID);
  console.log("   name:", testUser.name);
  console.log("");
  
  try {
    const result = await makeRequest("/facial/user/create", testUser);
    
    console.log("📊 STATUS:", result.statusCode);
    console.log("📄 RESPOSTA:");
    console.log(JSON.stringify(result.data, null, 2));
    console.log("");
    
    if (result.data.ok) {
      console.log("✅ SUCESSO! Usuário criado.");
      console.log("⚠️  Lembre-se: Senha deve ser definida manualmente no painel");
    } else {
      console.log("❌ FALHOU!");
      if (result.data.error) {
        console.log("   Erro:", result.data.error);
      }
      if (result.data.solution) {
        console.log("   Solução:", result.data.solution);
      }
    }
    
  } catch (error) {
    console.error("❌ ERRO NA REQUISIÇÃO:", error.message);
  }
  
  console.log("\n====================================");
}

// Executar teste
testCreateUser();