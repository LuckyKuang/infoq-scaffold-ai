import CryptoJS from 'crypto-js';
import { decryptBase64, decryptWithAes, encryptBase64, encryptWithAes, generateAesKey } from '@/utils/crypto';

describe('utils/crypto', () => {
  it('generates aes key with expected byte length', () => {
    const aesKey = generateAesKey();
    expect(aesKey.sigBytes).toBe(32);
  });

  it('encodes and decodes base64', () => {
    const source = CryptoJS.enc.Utf8.parse('hello-infoq');
    const encoded = encryptBase64(source);
    const decoded = decryptBase64(encoded);

    expect(CryptoJS.enc.Utf8.stringify(decoded)).toBe('hello-infoq');
  });

  it('encrypts and decrypts text using aes', () => {
    const aesKey = generateAesKey();
    const plaintext = '{"id":1,"name":"infoq"}';

    const cipher = encryptWithAes(plaintext, aesKey);
    const decrypted = decryptWithAes(cipher, aesKey);

    expect(decrypted).toBe(plaintext);
  });
});
