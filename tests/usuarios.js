const rpc2 = require('./rpc2');
const { encryptInfo, descriptografar } = require('./crypto');

/**
 * ✅ FUNCIONA - Busca usuário por ID
 */
async function buscarUsuario(userId) {
  console.log(`🔍 Buscando usuário ${userId}...`);
  
  // Inicia busca
  const startResult = await rpc2.call('AccessUser.startFind', {
    Condition: { UserID: String(userId) }
  });
  
  if (!startResult.result) {
    return null;
  }
  
  const token = startResult.params.Token;
  
  // Busca dados
  const findResult = await rpc2.call('AccessUser.doFind', {
    Token: token,
    Count: 1
  });
  
  // Finaliza
  await rpc2.call('AccessUser.stopFind', { Token: token });
  
  // Retorna usuário se encontrado
  if (findResult.result && findResult.params?.infos?.[0]) {
    return findResult.params.infos[0];
  }
  
  return null;
}

/**
 * ❌ NÃO FUNCIONA AINDA - Cadastrar usuário
 * 
 * PROBLEMA: Todos os métodos testados retornam result:false
 * 
 * Métodos tentados:
 * - Security.addUserPlain (direto) → erro -267976700
 * - Security.addUser (direto) → erro -267976700
 * - UserManager.addUser → erro -267976700
 * - system.multiSec + Security.addUserPlain → result:false sem erro
 * - system.multiSec + Security.addUser → result:false sem erro
 * 
 * POSSÍVEIS CAUSAS:
 * - Falta campo obrigatório (Doors? ValidFrom? ValidTo?)
 * - Formato do objeto usuário incorreto
 * - Firmware exige outro método não descoberto
 * 
 * WORKAROUND ATUAL:
 * - Cadastrar manualmente no painel web
 * - Depois usar API para adicionar foto facial
 */
async function cadastrarUsuario(usuario) {
  console.log('⚠️  cadastrarUsuario() NÃO IMPLEMENTADO');
  console.log('📝 Cadastre o usuário manualmente no painel web');
  console.log('💡 Depois use uploadFace() para adicionar a foto');
  
  throw new Error('Cadastro via API ainda não funciona - use o painel web');
}

/**
 * ✅ FUNCIONA - Upload de foto facial
 * (baseado no seu código do index.js)
 */
async function uploadFace(userId, photoBase64) {
  console.log(`📸 Fazendo upload de face para usuário ${userId}...`);
  
  const result = await rpc2.call('AccessFace.insertMulti', {
    FaceList: [
      {
        UserID: String(userId),
        PhotoData: [String(photoBase64)]
      }
    ]
  });
  
  const sucesso = result.result === true || (result.params && !result.error);
  
  if (sucesso) {
    console.log('✅ Face cadastrada com sucesso!');
  } else {
    console.log('❌ Erro ao cadastrar face:', result.error);
  }
  
  return {
    sucesso,
    dados: result
  };
}

/**
 * 🚧 EM TESTE - Listar todos os usuários
 * 
 * PROBLEMA: Dados podem vir criptografados (erro -267976701)
 * Se vier criptografado, precisa usar system.multiSec para descriptografar
 */
async function listarUsuarios() {
  console.log('📋 Listando usuários...');
  
  const startResult = await rpc2.call('AccessUser.startFind', {});
  
  if (!startResult.result) {
    throw new Error('Erro ao iniciar busca de usuários');
  }
  
  const token = startResult.params.Token;
  const total = startResult.params.Total;
  
  const findResult = await rpc2.call('AccessUser.doFind', {
    Token: token,
    Count: total
  });
  
  await rpc2.call('AccessUser.stopFind', { Token: token });
  
  // Verifica se dados vieram criptografados
  if (findResult.error?.code === -267976701) {
    console.log('⚠️  Dados criptografados - funcionalidade de descriptografia não implementada');
    throw new Error('Dados retornaram criptografados - não implementado ainda');
  }
  
  return findResult.params?.infos || [];
}

module.exports = {
  buscarUsuario,      // ✅ FUNCIONA
  uploadFace,         // ✅ FUNCIONA
  listarUsuarios,     // 🚧 FUNCIONA se dados não vierem criptografados
  cadastrarUsuario    // ❌ NÃO FUNCIONA (use painel web)
};