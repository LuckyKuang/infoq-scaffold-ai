import { describe, expect, it } from 'vitest';
import { decryptWithAes, encryptWithAes, generateAesKey } from '@/utils/crypto';

describe('utils/crypto', () => {
  it('should encrypt and decrypt text', () => {
    const key = generateAesKey();
    const plain = JSON.stringify({ user: 'admin', pass: '123456' });
    const encrypted = encryptWithAes(plain, key);
    const decrypted = decryptWithAes(encrypted, key);
    expect(decrypted).toBe(plain);
  });
});
