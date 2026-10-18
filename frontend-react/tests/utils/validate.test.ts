import { describe, expect, it } from 'vitest';
import { isPathMatch } from '@/utils/validate';

describe('utils/validate path globs', () => {
  it('matches only the documented single-segment and recursive wildcards', () => {
    expect(isPathMatch('/register*', '/register')).toBe(true);
    expect(isPathMatch('/register*', '/register/step-1')).toBe(false);
    expect(isPathMatch('/register/*', '/register/step-1')).toBe(true);
    expect(isPathMatch('/a/**', '/a/b/c')).toBe(true);
    expect(isPathMatch('/a/*', '/a/b/c')).toBe(false);
    expect(isPathMatch('/a/**/file.*', '/a/b/c/file.txt')).toBe(true);
  });

  it.each(['.', '+', '?', '^', '$', '|', '(', ')', '[', ']', '{', '}', '\\', '__DOUBLE_STAR__'])(
    'treats the non-wildcard character or old placeholder %j as literal input',
    (literal) => {
      expect(isPathMatch(`/a/${literal}`, `/a/${literal}`)).toBe(true);
      expect(isPathMatch(`/a/${literal}`, '/a/anything')).toBe(false);
      expect(isPathMatch(`/a/${literal}*`, `/a/${literal}tail`)).toBe(true);
      expect(isPathMatch(`/a/${literal}*`, '/a/anything')).toBe(false);
    }
  );

  it('does not interpret injected expressions or malformed regex text', () => {
    expect(isPathMatch('/a/(public|admin)', '/a/admin')).toBe(false);
    expect(isPathMatch('/a/file.txt', '/a/fileXtxt')).toBe(false);
    expect(isPathMatch('/a/[', '/a/[')).toBe(true);
    expect(isPathMatch('/a/\\d+$', '/a/123')).toBe(false);
    expect(isPathMatch('/a/__DOUBLE_STAR__', '/a/b/c')).toBe(false);
  });
});
