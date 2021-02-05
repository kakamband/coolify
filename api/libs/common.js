const crypto = require("crypto");
const shell = require("shelljs");
const jsonwebtoken = require("jsonwebtoken");
const { docker } = require('./docker')
const User = require('../models/User')
const algorithm = "aes-256-cbc";
const key = process.env.SECRETS_ENCRYPTION_KEY;

async function verifyUserId(authorization) {
  const token = authorization.split(" ")[1];
  const verify = jsonwebtoken.verify(token, process.env.JWT_SIGN_KEY);
  const found = await User.findOne({ uid: verify.jti });
  if (found) {
    return true
  } else {
    return false
  }
}
function execShellAsync(cmd, opts = {}) {
  return new Promise(function (resolve, reject) {
    shell.config.silent = true;
    shell.exec(cmd, opts, function (code, stdout, stderr) {
      if (code !== 0) return reject(new Error(stderr));
      return resolve(stdout);
    });
  });
}
function cleanupTmp(dir) {
  shell.rm("-fr", dir);
}

async function checkImageAvailable(name) {
  let cacheAvailable = false;
  try {
    await docker.engine.getImage(name).get();
    cacheAvailable = true;
  } catch (e) {
    // Cache image not found
  }
  return cacheAvailable;
}

function encryptData(text) {
  const iv = crypto.randomBytes(16);
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return { iv: iv.toString("hex"), encryptedData: encrypted.toString("hex") };
}

function decryptData(text) {
  let iv = Buffer.from(text.iv, "hex");
  let encryptedText = Buffer.from(text.encryptedData, "hex");
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

function createToken(payload) {
  const { uuid } = payload;
  return jsonwebtoken.sign({}, jwt.secret, {
    expiresIn: 15778800,
    algorithm: "HS256",
    audience: "coolify",
    issuer: "coolify",
    jwtid: uuid,
    subject: `User:${uuid}`,
    notBefore: -1000,
  });
}

module.exports = {
  createToken,
  execShellAsync,
  cleanupTmp,
  checkImageAvailable,
  encryptData,
  decryptData,
  verifyUserId
};
