const jsencryptMocks = vi.hoisted(() => {
  return {
    setPublicKey: vi.fn<(key: string) => void>(),
    encrypt: vi.fn<(txt: string) => string>(() => 'cipher-text'),
    setPrivateKey: vi.fn<(key: string) => void>(),
    decrypt: vi.fn<(txt: string) => string>(() => 'plain-text')
  };
});

vi.mock('jsencrypt', () => {
  class MockJSEncrypt {
    setPublicKey(key: string) {
      jsencryptMocks.setPublicKey(key);
    }
    encrypt(txt: string) {
      return jsencryptMocks.encrypt(txt);
    }
    setPrivateKey(key: string) {
      jsencryptMocks.setPrivateKey(key);
    }
    decrypt(txt: string) {
      return jsencryptMocks.decrypt(txt);
    }
  }

  return {
    default: MockJSEncrypt
  };
});

import { decrypt, encrypt } from '@/utils/jsencrypt';

describe('utils/jsencrypt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('encrypts text using public key', () => {
    const result = encrypt('hello');
    expect(result).toBe('cipher-text');
    expect(jsencryptMocks.setPublicKey).toHaveBeenCalledTimes(1);
    expect(jsencryptMocks.encrypt).toHaveBeenCalledWith('hello');
  });

  it('decrypts text using private key', () => {
    const result = decrypt('cipher');
    expect(result).toBe('plain-text');
    expect(jsencryptMocks.setPrivateKey).toHaveBeenCalledTimes(1);
    expect(jsencryptMocks.decrypt).toHaveBeenCalledWith('cipher');
  });
});
