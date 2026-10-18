/** 校验解码变体，但保留原始 query/hash 编码，避免改变参数含义。 */
export function requireSafeRedirect(value: unknown): string {
  if (value === null || value === undefined) return '/index';
  if (typeof value !== 'string' || !value) throw new Error('Invalid internal redirect');

  let candidate = value;
  let pathname = value.split(/[?#]/, 1)[0];
  for (let depth = 0; depth < 8; depth++) {
    if (
      !candidate.startsWith('/') ||
      candidate !== candidate.trim() ||
      pathname.includes('//') ||
      /[\\\p{Cc}\uFFFD]/u.test(candidate) ||
      pathname.split('/').some((segment) => segment === '.' || segment === '..')
    ) {
      throw new Error('Invalid internal redirect');
    }
    // 第一层错码拒绝；后续由合法 %25 产生的字面百分号保持原语义。
    if (depth > 0 && !/%[\da-f]{2}/i.test(candidate)) return value;
    let decoded: string;
    try {
      decoded = decodeURIComponent(depth === 0 ? candidate : candidate.replace(/%(?![\da-f]{2})/gi, '%25'));
      // 编码的 ?/# 仍属于原路径，不能让它们把后续点段藏进查询部分。
      pathname = decodeURIComponent(depth === 0 ? pathname : pathname.replace(/%(?![\da-f]{2})/gi, '%25'));
    } catch {
      throw new Error('Invalid internal redirect');
    }
    if (decoded === candidate) return value;
    candidate = decoded;
  }
  throw new Error('Invalid internal redirect');
}

export function requireAppRedirect(value: unknown, base = import.meta.env.BASE_URL): string {
  const target = requireSafeRedirect(value);
  const prefix = base === '/' ? '' : base.replace(/\/$/, '');
  const pathname = target.split(/[?#]/, 1)[0];
  if (!prefix || (pathname !== prefix && !pathname.startsWith(`${prefix}/`))) return target;

  const appTarget = target.slice(prefix.length);
  const result = !appTarget || /^[?#]/.test(appTarget) ? `/${appTarget}` : appTarget;
  const appPathname = result.split(/[?#]/, 1)[0];
  if (appPathname === prefix || appPathname.startsWith(`${prefix}/`)) throw new Error('Invalid internal redirect');
  return result;
}

export function toDeploymentRedirect(value: unknown, base = import.meta.env.BASE_URL): string {
  const target = requireAppRedirect(value, base);
  return base === '/' ? target : `${base.replace(/\/$/, '')}${target}`;
}
