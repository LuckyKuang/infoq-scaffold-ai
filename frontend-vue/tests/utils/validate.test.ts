import {
  isPathMatch,
  isHttp,
  isExternal,
  validUsername,
  validURL,
  validLowerCase,
  validUpperCase,
  validAlphabets,
  validEmail,
  isString,
  isArray
} from '@/utils/validate';

describe('utils/validate', () => {
  it('matches wildcard path patterns', () => {
    expect(isPathMatch('/register*', '/register')).toBe(true);
    expect(isPathMatch('/register*', '/register/step-1')).toBe(false);
    expect(isPathMatch('/register/*', '/register/step-1')).toBe(true);
    expect(isPathMatch('/a/**', '/a/b/c')).toBe(true);
    expect(isPathMatch('/a/*', '/a/b/c')).toBe(false);
  });

  it('checks http and external urls', () => {
    expect(isHttp('https://infoq.cc')).toBe(true);
    expect(isHttp('http://infoq.cc')).toBe(true);
    expect(isHttp('/system/user')).toBe(false);

    expect(isExternal('mailto:test@infoq.cc')).toBe(true);
    expect(isExternal('tel:10086')).toBe(true);
    expect(isExternal('https://infoq.cc')).toBe(true);
    expect(isExternal('/internal/path')).toBe(false);
  });

  it('validates string formats', () => {
    expect(validUsername(' admin ')).toBe(true);
    expect(validUsername('guest')).toBe(false);

    expect(validURL('https://example.com')).toBe(true);
    expect(validURL('not-a-url')).toBe(false);

    expect(validLowerCase('abc')).toBe(true);
    expect(validLowerCase('Abc')).toBe(false);

    expect(validUpperCase('ABC')).toBe(true);
    expect(validUpperCase('ABc')).toBe(false);

    expect(validAlphabets('AbCd')).toBe(true);
    expect(validAlphabets('Ab1')).toBe(false);

    expect(validEmail('a@b.com')).toBe(true);
    expect(validEmail('x@')).toBe(false);
  });

  it('checks generic type helpers', () => {
    expect(isString('abc')).toBe(true);
    expect(isString(new String('abc'))).toBe(true);
    expect(isString(1)).toBe(false);

    expect(isArray(['a'])).toBe(true);
    expect(isArray('a')).toBe(false);
  });

  it('falls back to Object.prototype.toString when Array.isArray is unavailable', () => {
    const originalIsArray = Array.isArray;
    Object.defineProperty(Array, 'isArray', {
      value: undefined,
      configurable: true
    });
    try {
      expect(isArray(['fallback'])).toBe(true);
      expect(isArray('fallback')).toBe(false);
    } finally {
      Object.defineProperty(Array, 'isArray', {
        value: originalIsArray,
        configurable: true
      });
    }
  });
});
