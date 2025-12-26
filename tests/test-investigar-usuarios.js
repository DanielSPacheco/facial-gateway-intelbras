const axios = require('axios');
const crypto = require('crypto');

const IP = '192.168.3.227';
const USER = 'admin';
const PASS = 'g274050nf.';
const URL = `http://${IP}/RPC2`;

function calcularHash(user, pass, realm, random) {
  const passHash = crypto
    .createHash('md5')
    .update(`${user}:${realm}:${pass}`)
    .digest("hex")
    .toUpperCase();
  
  const authorization = crypto
    .createHash('md5')
    .update(`${user}:${random}:${passHash}`)
    .digest("hex")
    .toUpperCase();
  
  return authorization;
}

async function login() {
  console.log('🔐 Fazendo login...\n');
  
  const step1 = await axios.post(`${URL}_Login`, {
    method: 'global.login',
    params: { userName: USER, password: '', clientType: 'Web3.0' },
    id: 1
  });
  
  if (step1.data.error && step1.data.error.code === 268632079) {
    const challenge = step1.data.params;
    const authorization = calcularHash(USER, PASS, challenge.realm, challenge.random);
    
    const step2 = await axios.post(`${URL}_Login`, {
      method: 'global.login',
      params: {
        userName: USER,
        password: authorization,
        clientType: 'Web3.0',
        authorityType: challenge.encryption
      },
      session: step1.data.session,
      id: 2
    });
    
    if (step2.data.result) {
      console.log('✅ Login realizado\n');
      return step2.data.session;
    }
  }
  throw new Error('Falha no login');
}

async function verificarUsuarioExiste(session, userID) {
  console.log(`🔍 Verificando se usuário ${userID} existe...\n`);
  
  const response = await axios.post(URL, {
    method: 'AccessUser.startFind',
    params: {
      Condition: { UserID: userID }
    },
    session: session,
    id: 100
  });
  
  console.log('📥 Resposta:', JSON.stringify(response.data, null, 2));
  
  return response.data;
}

async function listarTodosUsuarios(session) {
  console.log('📋 Listando TODOS os usuários...\n');
  
  // Tenta buscar sem condição
  const response = await axios.post(URL, {
    method: 'AccessUser.startFind',
    params: {
      Condition: {}
    },
    session: session,
    id: 101
  });
  
  console.log('📥 Resposta:', JSON.stringify(response.data, null, 2));
  
  if (response.data.result && response.data.params.Token) {
    console.log('\n🔄 Buscando próximos resultados...');
    
    const next = await axios.post(URL, {
      method: 'AccessUser.doFind',
      params: {
        Token: response.data.params.Token,
        Count: 10
      },
      session: session,
      id: 102
    });
    
    console.log('📥 Usuários encontrados:');
    console.log(JSON.stringify(next.data, null, 2));
  }
  
  return response.data;
}

async function tentarCadastroSimples(session) {
  console.log('👤 Tentando cadastro SEM criptografia...\n');
  
  const usuario = {
    UserID: "200",
    UserName: "TESTE API",
    UserType: 0,
    Authority: 1,
    Doors: "",
    RoomNumber: "",
    ValidFrom: "2024-01-01 00:00:00",
    ValidTo: "2037-12-31 23:59:59"
  };
  
  const metodosParaTestar = [
    'AccessUser.insert',
    'AccessUser.add',
    'AccessUser.create',
    'AccessUser.insertRecord',
    'Person.insert',
    'Person.add'
  ];
  
  for (const metodo of metodosParaTestar) {
    try {
      console.log(`Testando: ${metodo}`);
      const response = await axios.post(URL, {
        method: metodo,
        params: usuario,
        session: session,
        id: Math.floor(Math.random() * 1000000)
      }, { timeout: 3000 });
      
      console.log('  ✅ Resposta:', JSON.stringify(response.data, null, 2));
      
      if (response.data.result === true) {
        console.log(`\n🎉 SUCESSO COM O MÉTODO: ${metodo}\n`);
        return response.data;
      }
    } catch (error) {
      console.log(`  ❌ ${error.message}`);
    }
  }
}

async function main() {
  try {
    console.log('═══════════════════════════════════════');
    console.log('  INVESTIGANDO CADASTRO DE USUÁRIO');
    console.log('═══════════════════════════════════════\n');
    
    const session = await login();
    
    // 1. Verificar se usuário 100 (CLAUDE) existe
    await verificarUsuarioExiste(session, "100");
    
    console.log('\n═══════════════════════════════════════\n');
    
    // 2. Listar todos
    await listarTodosUsuarios(session);
    
    console.log('\n═══════════════════════════════════════\n');
    
    // 3. Tentar cadastro simples
    await tentarCadastroSimples(session);
    
    console.log('\n═══════════════════════════════════════');
    console.log('✅ INVESTIGAÇÃO CONCLUÍDA');
    console.log('═══════════════════════════════════════');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.response) {
      console.log(JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();