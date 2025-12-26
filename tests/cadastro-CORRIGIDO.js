const axios = require('axios');
const crypto = require('crypto');
const forge = require('node-forge'); // npm install node-forge

// ========================
// CONFIGURAÇÕES
// ========================
const IP = '192.168.3.227';
const USER = 'admin';
const PASS = 'g274050nf.';
const URL = `http://${IP}/RPC2`;

// Chave RSA pública extraída do browser
const RSA_PUBLIC_KEY = {
  N: 'D5B1A67746B34C6F5581A0D27C4589F83A3642C6B3BD1CE7253CA27B0078E2842537A2978CEC404BE8393A7B9A77ACCCF634FDBBFF07C02B7766A52D8DF505F5F05D28147E8D1C05527B01FF0F9D7D1EF5D9616D7AD5DDAF50460AEE0DD5CEAE9AC4991FBED58799B16FBC91CFAAC75C74A296BEAE360B52F07929F923A558EAC32A73E22C0926A528FD6DEA56486358479DFF09A5C4161051D0A300F2BB2C0392EA3E27C02509ED70F6E9B5608EF9950EBA17F51DAA018DF374586FBE2BB88522550303B77284D7247C79BDA735786014749021D5381B0941BCD562D51E8508581C3B381A372B33EBDDD3722AFD0D4AFB69E152FAD4D97C2C7DBA069D97B2C7',
  E: '010001'
};

// ========================
// FUNÇÕES DE CRIPTOGRAFIA
// ========================

/**
 * Gera uma chave AES aleatória de 32 dígitos SEM ZEROS (igual ao browser)
 */
function gerarChaveAES(tamanho = 32) {
  let t = "";
  while (t.length < tamanho) {
    let o = Math.random().toString().substr(2); // números
    // remove zeros (igual ao browser)
    o = o.replace(/0/g, "");
    if (o.length) t += o;
  }
  return t.substr(0, tamanho);
}

/**
 * Cifra a chave AES usando RSA (gera o salt)
 */
function cifrarChaveComRSA(chaveAES) {
  const n = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.N, 16);
  const e = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.E, 16);
  const publicKey = forge.pki.rsa.setPublicKey(n, e);

  const encrypted = publicKey.encrypt(chaveAES, 'RSAES-PKCS1-V1_5');
  
  // ✅ browser retorna hex LOWERCASE (toString(16))
  return forge.util.bytesToHex(encrypted).toLowerCase();
}

/**
 * Implementa Zero Padding para AES
 */
function zeroPadding(buf) {
  const block = 16;
  const padLen = (block - (buf.length % block)) % block;
  if (padLen === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(padLen, 0x00)]);
}

/**
 * Cifra dados com AES-256-CBC (RPAC-256)
 */
function cifrarComAES_RPAC256(chaveAES, dados) {
  const iv = Buffer.from('0000000000000000', 'utf8'); // ✅ IV fixo RPAC
  const key = Buffer.from(chaveAES, 'utf8');           // ✅ 32 bytes
  const json = Buffer.from(JSON.stringify(dados), 'utf8');
  const padded = zeroPadding(json);

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv); // ✅ AES-256
  cipher.setAutoPadding(false);

  const enc = Buffer.concat([cipher.update(padded), cipher.final()]);
  return enc.toString('base64');
}

/**
 * Implementa EncryptInfo igual ao browser (RPAC-256)
 */
function EncryptInfo(payload) {
  const chaveAES = gerarChaveAES(32);        // ✅ 32 dígitos
  const salt = cifrarChaveComRSA(chaveAES);  // ✅ RSA(s)
  const content = cifrarComAES_RPAC256(chaveAES, payload);

  return { salt, cipher: 'RPAC-256', content, key: chaveAES };
}

// ========================
// FUNÇÕES DE LOGIN
// ========================

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
  console.log('🔐 Fazendo login...\n');
  
  const step1 = await axios.post(URL + '_Login', {
    method: 'global.login',
    params: {
      userName: USER,
      password: '',
      clientType: 'Web3.0'
    },
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
  
  console.log('✅ Login realizado com sucesso!\n');
  return step2.data.session;
}

// ========================
// FUNÇÃO PRINCIPAL
// ========================

async function main() {
  try {
    // 1. Login
    const session = await login();
    
    // 2. Dados do usuário
    const usuario = {
      Id: '999', // ✅ só números
      Name: 'TESTE API CORRIGIDO',
      Password: '123456',
      Group: 'Default',
      Authority: 'User',
      Memo: 'Cadastrado com análise do browser'
    };
    
    console.log('📦 Dados do usuário:');
    console.log(JSON.stringify(usuario, null, 2));
    console.log('');
    
    // 3. TESTE 1: Com wrapper { user: ... }
    console.log('='.repeat(60));
    console.log('🧪 TESTE 1: Com wrapper { user: {...} }');
    console.log('='.repeat(60));
    
    const payload1 = EncryptInfo({ user: usuario }); // ✅ wrapper
    
    console.log('🔑 Dados cifrados:');
    console.log(`   Salt: ${payload1.salt.substring(0, 50)}...`);
    console.log(`   Cipher: ${payload1.cipher}`);
    console.log(`   Content: ${payload1.content.substring(0, 50)}...`);
    console.log('');
    
    console.log('📡 Enviando com params ARRAY [salt, cipher, content]...\n');
    
    try {
      const response1 = await axios.post(URL, {
        method: 'Security.addUserPlain',
        params: [payload1.salt, payload1.cipher, payload1.content], // ✅ array!
        session: session,
        id: 100
      });
      
      console.log('📥 Resposta:');
      console.log(JSON.stringify(response1.data, null, 2));
      
      if (response1.data.result !== false) {
        console.log('\n🎉🎉🎉 SUCESSO COM WRAPPER! 🎉🎉🎉');
        return;
      } else {
        console.log(`\n❌ Falhou - Erro ${response1.data.error?.code}`);
      }
    } catch (error) {
      console.log('\n❌ ERRO:', error.message);
    }
    
    // 4. TESTE 2: Sem wrapper (dados diretos)
    console.log('\n' + '='.repeat(60));
    console.log('🧪 TESTE 2: Sem wrapper (dados diretos)');
    console.log('='.repeat(60));
    
    const payload2 = EncryptInfo(usuario); // ✅ sem wrapper
    
    console.log('🔑 Dados cifrados:');
    console.log(`   Salt: ${payload2.salt.substring(0, 50)}...`);
    console.log(`   Cipher: ${payload2.cipher}`);
    console.log(`   Content: ${payload2.content.substring(0, 50)}...`);
    console.log('');
    
    console.log('📡 Enviando com params ARRAY [salt, cipher, content]...\n');
    
    try {
      const response2 = await axios.post(URL, {
        method: 'Security.addUserPlain',
        params: [payload2.salt, payload2.cipher, payload2.content], // ✅ array!
        session: session,
        id: 101
      });
      
      console.log('📥 Resposta:');
      console.log(JSON.stringify(response2.data, null, 2));
      
      if (response2.data.result !== false) {
        console.log('\n🎉🎉🎉 SUCESSO SEM WRAPPER! 🎉🎉🎉');
        return;
      } else {
        console.log(`\n❌ Falhou - Erro ${response2.data.error?.code}`);
      }
    } catch (error) {
      console.log('\n❌ ERRO:', error.message);
    }
    
    console.log('\n😞 Ambos falharam. Vamos precisar capturar requisição real do browser!');
    
  } catch (error) {
    console.error('\n❌ ERRO GERAL:', error.message);
    if (error.response) {
      console.error('Resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();