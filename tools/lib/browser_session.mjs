// Share the browser's cookie jar; access tokens never enter browser storage or logs.
export async function establishBrowserSession(context, {origin, client, clientId, token, apiPrefix = '/dev-api', timeoutMs = 10000, page}) {
  const target = new URL(origin);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password
      || !['react', 'vue'].includes(client) || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(clientId || '')
      || !['/dev-api', '/prod-api'].includes(apiPrefix) || typeof token !== 'string' || !token
      || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) {
    throw new Error('Invalid browser session target, client, token, API prefix or timeout.');
  }
  const endpoint = `${target.origin}${apiPrefix}/auth/browser-session`;
  const headers = {Origin: target.origin, clientid: clientId, 'X-InfoQ-Browser-Session': client};
  // A browser page honors Chromium's host resolver rules, unlike APIRequestContext.
  if (page) {
    if (new URL(page.url()).origin !== target.origin) throw new Error('Browser session page must already use the intended origin.');
    const result = await page.evaluate(async ({endpoint, headers, token, timeoutMs}) => {
      const signal = AbortSignal.timeout(timeoutMs);
      let stage = 'CSRF';
      try {
        const csrf = await fetch(`${endpoint}/csrf`, {headers, credentials:'same-origin', signal, redirect:'error'});
        const bootstrap = await csrf.json();
        if (csrf.status !== 200 || bootstrap?.code !== 200 || bootstrap.data?.headerName !== 'X-XSRF-TOKEN'
            || typeof bootstrap.data?.token !== 'string' || !bootstrap.data.token) return {stage, status:csrf.status};
        stage = 'binding';
        const response = await fetch(endpoint, {method:'PUT', credentials:'same-origin', signal, redirect:'error', headers:{...headers, Authorization:`Bearer ${token}`, 'X-XSRF-TOKEN':bootstrap.data.token}});
        const bound = await response.json();
        return response.status===200 && bound?.code===200 ? {ok:true} : {stage,status:response.status};
      } catch {return {stage, failed:true};}
    }, {endpoint, headers, token, timeoutMs});
    if (!result.ok) throw new Error(`Browser session ${result.stage} failed${result.status ? ` (HTTP ${result.status})` : ' (transport or protocol error)'}.`);
    return;
  }
  let csrfResponse;
  try {
    csrfResponse = await context.request.get(`${endpoint}/csrf`, {headers, timeout: timeoutMs, maxRedirects: 0});
  } catch (error) {
    throw new Error(`Browser session CSRF request failed (${error.name === 'TimeoutError' ? 'timeout' : 'transport error'}).`);
  }
  let csrf;
  try { csrf = await csrfResponse.json(); } catch { throw new Error(`Browser session CSRF returned invalid JSON (HTTP ${csrfResponse.status()}).`); }
  if (csrfResponse.status() !== 200 || csrf?.code !== 200
      || csrf.data?.headerName !== 'X-XSRF-TOKEN' || typeof csrf.data?.token !== 'string' || !csrf.data.token) {
    throw new Error(`Browser session CSRF rejected (HTTP ${csrfResponse.status()}).`);
  }
  let bound;
  try {
    bound = await context.request.put(endpoint, {
      headers: {...headers, Authorization: `Bearer ${token}`, 'X-XSRF-TOKEN': csrf.data.token},
      timeout: timeoutMs, maxRedirects: 0
    });
  } catch (error) {
    throw new Error(`Browser session binding request failed (${error.name === 'TimeoutError' ? 'timeout' : 'transport error'}).`);
  }
  let result;
  try { result = await bound.json(); } catch { throw new Error(`Browser session binding returned invalid JSON (HTTP ${bound.status()}).`); }
  if (bound.status() !== 200 || result?.code !== 200) {
    throw new Error(`Browser session binding rejected (HTTP ${bound.status()}).`);
  }
}
