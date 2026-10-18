// Browser-generated diagnostics can include authenticated URLs even when application logs do not.
export function createBrowserEvidence(secrets = []) {
  const known = new Set();
  const normalizeEscapes = value => value.replace(/%[\da-f]{2}/giu, match => match.toUpperCase());
  const add = value => {
    if (typeof value === 'string' && value) {
      known.add(value);
      known.add(encodeURIComponent(value));
      known.add(encodeURI(value));
      known.add(new URLSearchParams({value}).toString().slice(6));
    }
  };
  secrets.forEach(add);
  const text = value => {
    let result = String(value);
    for (const secret of [...known].sort((left,right) => right.length-left.length)) {
      const normalized = normalizeEscapes(result);
      const needle = normalizeEscapes(secret);
      const parts = [];
      let start = 0, index;
      while ((index = normalized.indexOf(needle,start)) !== -1) {
        parts.push(result.slice(start,index),'[redacted-token]');
        start = index + needle.length;
      }
      if (parts.length) result = parts.join('') + result.slice(start);
    }
    return result;
  };
  const sanitize = value => {
    if (typeof value === 'string') return text(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item]) => [text(key),sanitize(item)]));
    return value;
  };
  const error = value => {
    const message = text(value?.message || value);
    const result = value instanceof AggregateError ? new AggregateError(value.errors.map(error),message) : new Error(message);
    result.name = text(value?.name || 'Error');
    if (value?.stack) result.stack = text(value.stack);
    if (value?.cause !== undefined) result.cause = error(value.cause);
    if (typeof value?.code === 'string' || typeof value?.code === 'number') result.code = sanitize(value.code);
    return result;
  };
  return {add,text,sanitize,error};
}
