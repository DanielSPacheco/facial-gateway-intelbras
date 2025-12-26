const axios = require('axios');
const crypto = require('crypto');

const IP = '192.168.3.227';
const USER = 'admin';
const PASS = 'g274050nf.';
const URL = `http://${IP}/RPC2`;

function calcularHash(user, pass, realm, random) {
  const passHash = crypto.createHash('md5')
    .update(`${user}:${realm}:${pass}`)
    .digest('hex')
    .toUpperCase();
  return crypto.createHash('md5')
    .update(`${user}:${random}:${passHash}`)
    .digest('hex')
    .toUpperCase();
}

async function login() {
  const step1 = await axios.post(URL + '_Login', {
    method: 'global.login',
    params: { userName: USER, password: '', clientType: 'Web3.0' },
    id: 1
  });
  const challenge = step1.data.params;
  const step2 = await axios.post(URL + '_Login', {
    method: 'global.login',
    params: {
      userName: USER,
      password: calcularHash(USER, PASS, challenge.realm, challenge.random),
      clientType: 'Web3.0',
      authorityType: challenge.encryption
    },
    session: step1.data.session,
    id: 2
  });
  return step2.data.session;
}

async function main() {
  try {
    console.log('🔐 Fazendo login...\n');
    const session = await login();
    console.log('✅ Login OK!\n');
    
    console.log('📋 Buscando usuário 777...\n');
    
    // Inicia busca
    const startFind = await axios.post(URL, {
      method: 'AccessUser.startFind',
      params: { Condition: { UserID: '777' } },
      session: session,
      id: 10
    });
    
    if (!startFind.data.result) {
      console.log('❌ Erro ao iniciar busca:', startFind.data.error);
      return;
    }
    
    const token = startFind.data.params.Token;
    console.log(`Token de busca: ${token}\n`);
    
    // Busca dados
    const doFind = await axios.post(URL, {
      method: 'AccessUser.doFind',
      params: { Token: token, Count: 1 },
      session: session,
      id: 11
    });
    
    // Finaliza busca
    await axios.post(URL, {
      method: 'AccessUser.stopFind',
      params: { Token: token },
      session: session,
      id: 12
    });
    
    if (doFind.data.result && doFind.data.params && doFind.data.params.infos) {
      console.log('🎉 USUÁRIO 777 ENCONTRADO!\n');
      console.log(JSON.stringify(doFind.data.params.infos, null, 2));
    } else {
      console.log('❌ Usuário 777 não foi encontrado no equipamento.');
      console.log('Resposta:', JSON.stringify(doFind.data, null, 2));
    }
    
  } catch (error) {
    console.error('❌ ERRO:', error.message);
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();