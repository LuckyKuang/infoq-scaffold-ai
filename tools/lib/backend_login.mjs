#!/usr/bin/env node
// InfoQ 后端登录加密共享实现：RSA 头密钥 + AES-256-ECB(PKCS7) 载荷。
// 被 infoq-test 的真实验证码登录与 tools/verify 的快速登录校验共同复用，避免两处实现漂移。
import crypto from 'node:crypto';

export function toPem(base64Key) {
  const lines = (base64Key.match(/.{1,64}/g) || []).join('\n');
  return `-----BEGIN PUBLIC KEY-----\n${lines}\n-----END PUBLIC KEY-----\n`;
}

export function randomAesKey(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

export function encryptWithAesEcbPkcs7(plainText, aesKey) {
  const cipher = crypto.createCipheriv('aes-256-ecb', Buffer.from(aesKey, 'utf8'), null);
  cipher.setAutoPadding(true);
  return Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]).toString('base64');
}

export function encryptHeaderKey(aesKey, publicKeyBase64) {
  const b64Aes = Buffer.from(aesKey, 'utf8').toString('base64');
  return crypto
    .publicEncrypt({key: toPem(publicKeyBase64), padding: crypto.constants.RSA_PKCS1_PADDING}, Buffer.from(b64Aes, 'utf8'))
    .toString('base64');
}
