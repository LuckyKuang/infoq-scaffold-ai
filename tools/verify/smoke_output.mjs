// Authentication fields are a private subprocess protocol, never public log output.
export function parseSmokeAuthenticationOutput(output) {
  const lines = String(output).split(/\r?\n/);
  const tokens = lines.filter((line) => line.startsWith('TOKEN='));
  const users = lines.filter((line) => line.startsWith('USER_ID='));
  const token = tokens[0]?.slice('TOKEN='.length).trim();
  const userId = users[0]?.slice('USER_ID='.length).trim();
  if (tokens.length !== 1 || users.length !== 1 || !token || !userId) {
    throw new Error('[cluster-smoke] expected one nonempty TOKEN and USER_ID from smoke checks');
  }
  return {
    token,
    userId,
    publicOutput: lines.filter((line) => !line.startsWith('TOKEN=') && !line.startsWith('USER_ID=')).join('\n')
  };
}
