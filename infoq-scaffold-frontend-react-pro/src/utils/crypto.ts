import CryptoJS from 'crypto-js';

const generateRandomString = () => {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i += 1) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

export const generateAesKey = () =>
  CryptoJS.enc.Utf8.parse(generateRandomString());

export const encryptBase64 = (str: any) => CryptoJS.enc.Base64.stringify(str);

export const decryptBase64 = (str: string) => CryptoJS.enc.Base64.parse(str);

export const encryptWithAes = (message: string, aesKey: any) =>
  CryptoJS.AES.encrypt(message, aesKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();

export const decryptWithAes = (message: string, aesKey: any) =>
  CryptoJS.AES.decrypt(message, aesKey, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7,
  }).toString(CryptoJS.enc.Utf8);
