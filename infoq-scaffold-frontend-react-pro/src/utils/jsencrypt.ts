import JSEncrypt from 'jsencrypt';

const publicKey = process.env.VITE_APP_RSA_PUBLIC_KEY;
const privateKey = process.env.VITE_APP_RSA_PRIVATE_KEY;

export const encrypt = (txt: string) => {
  if (!publicKey) {
    throw new Error('RSA public key is required when VITE_APP_ENCRYPT=true');
  }
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(publicKey);
  const result = encryptor.encrypt(txt);
  if (!result) {
    throw new Error('RSA encrypt failed');
  }
  return result;
};

export const decrypt = (txt: string) => {
  if (!privateKey) {
    throw new Error('RSA private key is required when VITE_APP_ENCRYPT=true');
  }
  const encryptor = new JSEncrypt();
  encryptor.setPrivateKey(privateKey);
  const result = encryptor.decrypt(txt);
  if (!result) {
    throw new Error('RSA decrypt failed');
  }
  return result;
};
