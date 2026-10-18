// 将 Git 读写目标绑定到同一个明确的 gh repository，避免环境变量或多 remote 选错仓库。
export function githubRepositoryFromRemote(value) {
  let host;
  let pathname;
  const scp = String(value).match(/^git@([^/:]+):([^\s]+)$/u);
  if (scp) {
    [, host, pathname] = scp;
  } else {
    let url;
    try { url = new URL(value); } catch { throw new Error('Git remote 必须使用 GitHub HTTPS 或 SSH URL'); }
    if (!['https:', 'ssh:'].includes(url.protocol) || url.password || url.search || url.hash ||
        (url.protocol === 'https:' && (url.username || url.port)) || (url.protocol === 'ssh:' && url.username !== 'git')) {
      throw new Error('Git remote URL 协议或凭据格式不受支持；请使用无内嵌秘密的 HTTPS/SSH URL');
    }
    host = url.hostname;
    pathname = url.pathname.replace(/^\//u, '');
  }
  pathname = pathname.replace(/\/$/u, '').replace(/\.git$/u, '');
  if (!/^[a-z0-9.-]+$/iu.test(host) || !/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/iu.test(pathname)) {
    throw new Error('Git remote 必须唯一标识 host/owner/repository');
  }
  return `${host}/${pathname}`.toLowerCase();
}

export function githubRepositoryForRemote(git, remote) {
  const fetchUrls = git(['remote', 'get-url', '--all', remote]).stdout.trim().split(/\r?\n/u);
  const pushUrls = git(['remote', 'get-url', '--push', '--all', remote]).stdout.trim().split(/\r?\n/u);
  if (fetchUrls.length !== 1 || pushUrls.length !== 1) throw new Error(`${remote} 必须只有一个 fetch 和 push URL`);
  const fetchTarget = githubRepositoryFromRemote(fetchUrls[0]);
  const pushTarget = githubRepositoryFromRemote(pushUrls[0]);
  if (fetchTarget !== pushTarget) throw new Error(`${remote} 的 fetch/push 指向不同仓库；拒绝继续`);
  return fetchTarget;
}
