const axios = require("axios");
const crypto = require("crypto");
const forge = require("node-forge");

const IP = "192.168.3.227";
const USER = "admin";
const PASS = "g274050nf.";
const URL_LOGIN = `http://${IP}/RPC2_Login`;
const URL = `http://${IP}/RPC2`;

const RSA_PUBLIC_KEY = {
  N: "D5B1A67746B34C6F5581A0D27C4589F83A3642C6B3BD1CE7253CA27B0078E2842537A2978CEC404BE8393A7B9A77ACCCF634FDBBFF07C02B7766A52D8DF505F5F05D28147E8D1C05527B01FF0F9D7D1EF5D9616D7AD5DDAF50460AEE0DD5CEAE9AC4991FBED58799B16FBC91CFAAC75C74A296BEAE360B52F07929F923A558EAC32A73E22C0926A528FD6DEA56486358479DFF09A5C4161051D0A300F2BB2C0392EA3E27C02509ED70F6E9B5608EF9950EBA17F51DAA018DF374586FBE2BB88522550303B77284D7247C79BDA735786014749021D5381B0941BCD562D51E8508581C3B381A372B33EBDDD3722AFD0D4AFB69E152FAD4D97C2C7DBA069D97B2C7",
  E: "010001",
};

function md5Upper(s) {
  return crypto.createHash("md5").update(s).digest("hex").toUpperCase();
}
function calcularHash(user, pass, realm, random) {
  const passHash = md5Upper(`${user}:${realm}:${pass}`);
  return md5Upper(`${user}:${random}:${passHash}`);
}

async function login() {
  const step1 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: { userName: USER, password: "", clientType: "Web3.0" },
    id: 1,
  });
  const ch = step1.data.params;

  const step2 = await axios.post(URL_LOGIN, {
    method: "global.login",
    params: {
      userName: USER,
      password: calcularHash(USER, PASS, ch.realm, ch.random),
      clientType: "Web3.0",
      authorityType: ch.encryption,
    },
    session: step1.data.session,
    id: 2,
  });

  return step2.data.session;
}

// ===== RPAC-256 (igual vocês já validaram) =====
function gerarChaveAES(tamanho = 32) {
  let t = "";
  while (t.length < tamanho) {
    let o = Math.random().toString().substr(2).replace(/0/g, "");
    if (o.length) t += o;
  }
  return t.substr(0, tamanho);
}
function cifrarChaveComRSA(chaveAES) {
  const n = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.N, 16);
  const e = new forge.jsbn.BigInteger(RSA_PUBLIC_KEY.E, 16);
  const publicKey = forge.pki.rsa.setPublicKey(n, e);
  const encrypted = publicKey.encrypt(chaveAES, "RSAES-PKCS1-V1_5");
  return forge.util.bytesToHex(encrypted).toLowerCase();
}
function zeroPadding(buf) {
  const block = 16;
  const padLen = (block - (buf.length % block)) % block;
  if (padLen === 0) return buf;
  return Buffer.concat([buf, Buffer.alloc(padLen, 0x00)]);
}
function removeZeroPadding(buf) {
  let end = buf.length;
  while (end > 0 && buf[end - 1] === 0x00) end--;
  return buf.slice(0, end);
}
function aesEnc(chaveAES, payload) {
  const iv = Buffer.from("0000000000000000", "utf8");
  const key = Buffer.from(chaveAES, "utf8");
  const json = Buffer.from(JSON.stringify(payload), "utf8");
  const padded = zeroPadding(json);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  cipher.setAutoPadding(false);
  const enc = Buffer.concat([cipher.update(padded), cipher.final()]);
  return enc.toString("base64");
}
function aesDec(chaveAES, contentB64) {
  const iv = Buffer.from("0000000000000000", "utf8");
  const key = Buffer.from(chaveAES, "utf8");
  const enc = Buffer.from(contentB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return removeZeroPadding(dec).toString("utf8");
}
function encryptCalls(calls) {
  const key = gerarChaveAES(32);
  return {
    key,
    salt: cifrarChaveComRSA(key),
    cipher: "RPAC-256",
    content: aesEnc(key, calls),
  };
}

async function multiSec(session, calls) {
  const enc = encryptCalls(calls);
  const resp = await axios.post(URL, {
    method: "system.multiSec",
    params: { salt: enc.salt, cipher: enc.cipher, content: enc.content },
    session,
    id: 200,
  });

  const newSession = resp.data.session || session;
  const plain = aesDec(enc.key, resp.data.params.content);

  let parsed;
  try { parsed = JSON.parse(plain); } catch { parsed = plain; }

  return { resp: resp.data, session: newSession, plain, parsed };
}

(async () => {
  let session = await login();
  console.log("✅ session:", session);

  // ⚠️ use um ID que não existe (pra evitar “já existe”)
  const userId = String(Date.now()).slice(-6); // ex: 482913
  const nome = "TESTE API";
  const senha = "123456";

  // Formatos comuns que variam por firmware
  const variants = [
    {
      label: "V1 AccessUser.addUser (params.User)",
      method: "AccessUser.addUser",
      params: { User: { UserID: userId, UserName: nome, Password: senha, Authority: "User" } },
    },
    {
      label: "V2 AccessUser.addUser (params.UserInfo)",
      method: "AccessUser.addUser",
      params: { UserInfo: { UserID: userId, UserName: nome, Password: senha, Authority: "User" } },
    },
    {
      label: "V3 AccessUser.insert (params.User)",
      method: "AccessUser.insert",
      params: { User: { UserID: userId, UserName: nome, Password: senha, Authority: "User" } },
    },
    {
      label: "V4 AccessUser.add (params direto)",
      method: "AccessUser.add",
      params: { UserID: userId, UserName: nome, Password: senha, Authority: "User" },
    },
    {
      label: "V5 AccessPersonInfo.insert (person básico)",
      method: "AccessPersonInfo.insert",
      params: { Person: { UserID: userId, Name: nome } },
    },
    {
      label: "V6 AccessPersonInfo.addPerson (person básico)",
      method: "AccessPersonInfo.addPerson",
      params: { Person: { UserID: userId, Name: nome } },
    },
  ];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    console.log("\n==============================");
    console.log("🚀 Tentando:", v.label);

    const calls = [{
      method: v.method,
      params: v.params,
      id: 101 + i,
    }];

    const r = await multiSec(session, calls);
    session = r.session;

    console.log("🔓 plain:", r.plain);

    const first = Array.isArray(r.parsed) ? r.parsed[0] : r.parsed;
    if (first?.result === true) {
      console.log("\n🎉 SUCESSO! Método/payload:", v.label);
      console.log("✅ userId criado:", userId);
      process.exit(0);
    } else {
      console.log("❌ Falhou:", first?.error || first);
    }
  }

  console.log("\n😞 Nenhuma variação funcionou. Aí precisamos do DevTools do CREATE USER (o request exato).");
})().catch((e) => {
  console.error("ERRO:", e.message);
  if (e.response) console.error(JSON.stringify(e.response.data, null, 2));
});