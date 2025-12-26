const axios = require('axios');
const crypto = require('crypto');
const forge = require('node-forge');

const IP = '192.168.3.227';
const USER = 'admin';
const PASS = 'g274050nf.';
const URL = `http://${IP}/RPC2`;

const RSA_PUBLIC_KEY = {
  N: 'D5B1A67746B34C6F5581A0D27C4589F83A3642C6B3BD1CE7253CA27B0078E2842537A2978CEC404BE8393A7B9A77ACCCF634FDBBFF07C02B7766A52D8DF505F5F05D28147E8D1C05527B01FF0F9D7D1EF5D9616D7AD5DDAF50460AEE0DD5CEAE9AC4991FBED58799B16FBC91CFAAC75C74A296BEAE360B52F07929F923A558EAC32A73E22C0926A528FD6DEA56486358479DFF09A5C4161051D0A300F2BB2C0392EA3E27C02509ED70F6E9B5608EF9950EBA17F51DAA018DF374586FBE2BB88522550303B77284D7247C79BDA735786014749021D5381B0941BCD562D51E8508581C3B381A372B33EBDDD3722AFD0D4AFB69E152FAD4D97C2C7DBA069D97B2C7',
  E: '010001'
};

function gerarChaveAES(tamanho = 32) {
  let t = "";
  while (t.length < tamanho) {
    let o = Math.random().toString().substr(2);
    o = o.replace(/0/g, "");
    if (o.length) t += o;
  }
  return t.substr(0, tamanho);
}

function cifrarChaveComRSA(chaveAES) {
  const n = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.N, 16);
  const e = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.E, 16);
  const publicKey = forge.pki.rsa.setPublicKey(n, e);
  const encrypted = publicKey.encrypt(chaveAES, 'RSAES-PKCS1-V1_5');
  return forge.util.bytesToHex(encrypted).toLowerCase();
}

function zeroPadding(buf) {
  const block = 16;
  const padLen = (block - (buf.length % block)) % block;
  if (padLen === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(padLen, 0x00)]);
}

function cifrarComAES_RPAC256(chaveAES, dados) {
  const iv = Buffer.from('0000000000000000', 'utf8');
  const key = Buffer.from(chaveAES, 'utf8');
  const json = Buffer.from(JSON.stringify(dados), 'utf8');
  const padded = zeroPadding(json);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  cipher.setAutoPadding(false);
  const enc = Buffer.concat([cipher.update(padded), cipher.final()]);
  return enc.toString('base64');
}

function descriptografarResposta(chaveAES, contentBase64) {
  try {
    const iv = Buffer.from('0000000000000000', 'utf8');
    const key = Buffer.from(chaveAES, 'utf8');
    const encryptedContent = Buffer.from(contentBase64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    let decrypted = Buffer.concat([decipher.update(encryptedContent), decipher.final()]);
    
    // Remove zero padding
    let i = decrypted.length - 1;
    while (i >= 0 && decrypted[i] === 0) i--;
    decrypted = decrypted.slice(0, i + 1);
    
    return decrypted.toString('utf8');
  } catch (error) {
    throw new Error(`Erro ao descriptografar: ${error.message}`);
  }
}

function EncryptInfo(payload) {
  const chaveAES = gerarChaveAES(32);
  const salt = cifrarChaveComRSA(chaveAES);
  const content = cifrarComAES_RPAC256(chaveAES, payload);
  return { salt, cipher: 'RPAC-256', content, key: chaveAES };
}

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
  console.log('✅ Login realizado!\n');
  return step2.data.session;
}

async function main() {
  try {
    const session = await login();
    
    const usuario = {
      Id: '777',
      Name: 'TESTE VIA MULTISEC',
      Password: '123456',
      Group: 'Default',
      Authority: 'User'
    };
    
    console.log('📦 Usuario:', JSON.stringify(usuario, null, 2));
    console.log('');
    
    // Monta a call interna
    const call = {
      method: 'Security.addUserPlain',
      params: { user: usuario }
    };
    
    console.log('🔐 Cifrando CALL completa...\n');
    const encrypted = EncryptInfo([call]);
    
    console.log('🔑 Chave AES gerada:', encrypted.key);
    console.log(`   Salt: ${encrypted.salt.substring(0, 60)}...`);
    console.log(`   Cipher: ${encrypted.cipher}`);
    console.log(`   Content: ${encrypted.content.substring(0, 60)}...`);
    console.log('');
    
    console.log('📡 Enviando via system.multiSec...\n');
    
    const response = await axios.post(URL, {
      method: 'system.multiSec',
      params: {
        salt: encrypted.salt,
        cipher: encrypted.cipher,
        content: encrypted.content
      },
      session: session,
      id: 200
    });
    
    console.log('📥 Resposta CIFRADA:');
    console.log(JSON.stringify(response.data, null, 2));
    console.log('');
    
    // DESCRIPTOGRAFA A RESPOSTA
    if (response.data.params && response.data.params.content) {
      console.log('🔓 Descriptografando resposta...\n');
      
      const decryptedText = descriptografarResposta(encrypted.key, response.data.params.content);
      console.log('📄 Resposta DESCRIPTOGRAFADA (raw):');
      console.log(decryptedText);
      console.log('');
      
      try {
        const jsonResponse = JSON.parse(decryptedText);
        console.log('📦 JSON Parseado:');
        console.log(JSON.stringify(jsonResponse, null, 2));
        console.log('');
        
        if (Array.isArray(jsonResponse) && jsonResponse[0]) {
          const result = jsonResponse[0];
          
          if (result.result === true) {
            console.log('🎉🎉🎉 USUÁRIO 777 CADASTRADO COM SUCESSO! 🎉🎉🎉');
          } else {
            console.log('❌ Erro no cadastro:');
            console.log(`   Código: ${result.error?.code || 'desconhecido'}`);
            console.log(`   Mensagem: ${result.error?.message || 'sem mensagem'}`);
          }
        } else {
          console.log('⚠️ Formato de resposta inesperado');
        }
        
      } catch (e) {
        console.log('⚠️ Não conseguiu parsear JSON:', e.message);
      }
    } else {
      console.log('⚠️ Resposta não contém content para descriptografar');
    }
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
  }
}

main();