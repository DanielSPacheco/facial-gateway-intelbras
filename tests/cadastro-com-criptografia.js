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
 * Gera uma chave AES aleatória (16 ou 32 dígitos numéricos)
 */
function gerarChaveAES(tamanho = 16) {
  let chave = '';
  for (let i = 0; i < tamanho; i++) {
    chave += Math.floor(Math.random() * 10).toString();
  }
  return chave;
}

/**
 * Cifra a chave AES usando RSA (gera o salt)
 */
function cifrarChaveComRSA(chaveAES) {
  // Converte N e E de hex para BigInteger
  const n = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.N, 16);
  const e = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.E, 16);
  
  // Cria chave pública RSA
  const publicKey = forge.pki.rsa.setPublicKey(n, e);
  
  // Cifra a chave AES usando PKCS#1 v1.5
  const encrypted = publicKey.encrypt(chaveAES, 'RSAES-PKCS1-V1_5');
  
  // Retorna em hexadecimal
  return forge.util.bytesToHex(encrypted);
}

/**
 * Implementa Zero Padding para AES
 */
function zeroPadding(data) {
  const blockSize = 16;
  const buffer = Buffer.from(data, 'utf8');
  const paddingLength = blockSize - (buffer.length % blockSize);
  
  if (paddingLength === blockSize) {
    return buffer; // Já está alinhado
  }
  
  const paddedBuffer = Buffer.alloc(buffer.length + paddingLength);
  buffer.copy(paddedBuffer);
  // Os bytes restantes já são zero por padrão
  
  return paddedBuffer;
}

/**
 * Cifra dados com AES-128-CBC (RPAC-256)
 */
function cifrarComAES_RPAC(chaveAES, dados) {
  const iv = Buffer.from('0000000000000000', 'utf8'); // IV fixo para RPAC
  
  // Converte chave AES de string para buffer de 16 bytes
  const chaveBuffer = Buffer.from(chaveAES.padEnd(16, '0').substring(0, 16), 'utf8');
  
  // Serializa dados para JSON
  const jsonString = JSON.stringify(dados);
  
  // Aplica Zero Padding
  const paddedData = zeroPadding(jsonString);
  
  // Cifra com AES-128-CBC
  const cipher = crypto.createCipheriv('aes-128-cbc', chaveBuffer, iv);
  cipher.setAutoPadding(false); // Usamos zero padding manual
  
  let encrypted = cipher.update(paddedData);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // Retorna em base64
  return encrypted.toString('base64');
}

/**
 * Cifra dados com AES-128-ECB (padrão antigo)
 */
function cifrarComAES_ECB(chaveAES, dados) {
  // Converte chave AES de string para buffer de 16 bytes
  const chaveBuffer = Buffer.from(chaveAES.padEnd(16, '0').substring(0, 16), 'utf8');
  
  // Serializa dados para JSON
  const jsonString = JSON.stringify(dados);
  
  // Aplica Zero Padding
  const paddedData = zeroPadding(jsonString);
  
  // Cifra com AES-128-ECB
  const cipher = crypto.createCipheriv('aes-128-ecb', chaveBuffer, null);
  cipher.setAutoPadding(false); // Usamos zero padding manual
  
  let encrypted = cipher.update(paddedData);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  // Retorna em base64
  return encrypted.toString('base64');
}

/**
 * Implementa EncryptInfo completo (equivalente ao browser)
 */
function EncryptInfo(payload, useRPAC = true) {
  // 1. Gera chave AES aleatória
  const chaveAES = gerarChaveAES(16);
  
  // 2. Cifra a chave AES com RSA (gera salt)
  const salt = cifrarChaveComRSA(chaveAES);
  
  // 3. Cifra o payload com AES
  let content, cipher;
  
  if (useRPAC) {
    content = cifrarComAES_RPAC(chaveAES, payload);
    cipher = 'RPAC-256';
  } else {
    content = cifrarComAES_ECB(chaveAES, payload);
    cipher = 'AES-256';
  }
  
  return {
    salt: salt,
    cipher: cipher,
    content: content,
    key: chaveAES // Guardamos para descriptografar resposta
  };
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
  
  // Primeiro desafio
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
  
  // Segundo desafio (com hash MD5)
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
    
    // 2. Dados do usuário a ser cadastrado
    const usuario = {
      Id: 'teste888',
      Name: 'TESTE CRIPTOGRAFIA',
      Password: '123456',
      Group: 'Default',
      Authority: 'User',
      Memo: 'Cadastrado via API com criptografia'
    };
    
    console.log('📦 Dados do usuário:');
    console.log(JSON.stringify(usuario, null, 2));
    console.log('');
    
    // 3. Testar ambos os métodos de criptografia
    const metodos = [
      { nome: 'RPAC-256 (CBC)', useRPAC: true },
      { nome: 'AES-256 (ECB)', useRPAC: false }
    ];
    
    for (const metodo of metodos) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`🧪 TESTANDO: ${metodo.nome}`);
      console.log('='.repeat(60));
      
      // Cifra os dados
      console.log('🔐 Cifrando dados...\n');
      const encrypted = EncryptInfo(usuario, metodo.useRPAC);
      
      console.log('🔑 Dados cifrados:');
      console.log(`   Salt: ${encrypted.salt.substring(0, 50)}...`);
      console.log(`   Cipher: ${encrypted.cipher}`);
      console.log(`   Content: ${encrypted.content.substring(0, 50)}...`);
      console.log('');
      
      // Envia para o equipamento
      console.log('📡 Enviando para Security.addUserPlain...\n');
      
      try {
        const response = await axios.post(URL, {
          method: 'Security.addUserPlain',
          params: {
            salt: encrypted.salt,
            cipher: encrypted.cipher,
            content: encrypted.content
          },
          session: session,
          id: 100
        });
        
        console.log('📥 Resposta:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data.result !== false) {
          console.log(`\n🎉 SUCESSO COM ${metodo.nome}!`);
          return; // Para se funcionar
        } else {
          console.log(`\n❌ Falhou com ${metodo.nome}`);
          console.log(`   Erro ${response.data.error?.code}: ${response.data.error?.message || 'sem mensagem'}`);
        }
      } catch (error) {
        console.log(`\n❌ ERRO com ${metodo.nome}:`, error.message);
      }
    }
    
    console.log('\n😞 Nenhum método funcionou. Precisamos capturar requisição real do browser!');
    
  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    if (error.response) {
      console.error('Resposta:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

// Executa
main();