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
      console.log('✅ Login OK\n');
      return step2.data.session;
    }
  }
  throw new Error('Falha no login');
}

async function testarMetodos(session) {
  const metodosParaTestar = [
    // Métodos comuns de usuário
    'AccessControl.addUser',
    'AccessControl.insertUser',
    'UserManager.addUser',
    'UserManager.insertUser',
    'Person.insert',
    'Person.add',
    'AccessUser.add',
    'AccessUser.create',
    
    // Métodos de listagem
    'AccessControl.getUsers',
    'UserManager.getUsers',
    'Person.getAll',
    'AccessUser.find',
    'AccessUser.getInfo',
    'AccessControl.getUserInfo',
  ];
  
  console.log('🔍 TESTANDO MÉTODOS DISPONÍVEIS...\n');
  
  const usuario = {
    UserID: "teste_" + Date.now(),
    UserName: "Teste API"
  };
  
  for (const metodo of metodosParaTestar) {
    try {
      const response = await axios.post(URL, {
        method: metodo,
        params: usuario,
        session: session,
        id: Math.floor(Math.random() * 1000000)
      }, { timeout: 3000 });
      
      if (response.data.result !== false || response.data.error?.code !== 268894210) {
        console.log(`✅ ${metodo}`);
        console.log(`   Resposta:`, JSON.stringify(response.data, null, 2));
        console.log('');
      }
    } catch (error) {
      // Ignora timeouts e erros de rede
    }
  }
  
  console.log('═══════════════════════════════════════');
}

async function main() {
  try {
    const session = await login();
    await testarMetodos(session);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

main();