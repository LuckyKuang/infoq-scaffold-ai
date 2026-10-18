import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {terminateProcessTree} from '../lib/skill_runtime.mjs';

const checks = {
  configuration: 'configuration', root: 'GET /', captcha: 'GET /auth/code', login: 'POST /auth/login',
  routers: 'GET /system/menu/getRouters', roleMenu: 'GET /system/menu/roleMenuTreeselect',
  departments: 'GET /system/role/deptTree', dictionary: 'GET /system/dict/data/type', export: 'POST /system/user/export',
  complete: 'smoke completed'
};
const reasons = {
  'invalid-login-mode': 'LOGIN_MODE must be encrypted or plain.',
  'invalid-timeout': 'HTTP_TIMEOUT_MS must be an integer from 1 to 60000 without leading zeros.',
  'legacy-output': 'PRINT_TOKEN / PRINT_USER_ID output is no longer supported; use the parent IPC runner.',
  'invalid-arguments': 'smoke_checks accepts no command-line arguments.',
  'ipc-required': 'authentication requires a connected parent IPC channel.',
  timeout: 'network=timeout', network: 'network=request-failed', body: 'network=response-read-failed',
  response: 'unexpected response', login: 'all attempts failed', export: 'invalid export response',
  'invalid-auth': 'invalid authentication response', internal: 'internal-error'
};
const requiredChecks = ['root','captcha','login','routers','roleMenu','departments','dictionary','export'];

// Only enum labels and bounded numeric protocol facts may reach logs. Raw inputs and errors never do.
export function formatSmokeDiagnostic(message) {
  if (!message || message.type !== 'smoke-status' || message.version !== 1 || !Object.hasOwn(checks, message.check) ||
    typeof message.passed !== 'boolean' || Object.keys(message).some(key => !['type','version','check','passed','reason','http','code','bytes','timeoutMs'].includes(key)) ||
    (message.reason !== undefined && !Object.hasOwn(reasons, message.reason)) ||
    ['http','bytes','timeoutMs'].some(key => message[key] !== undefined && (!Number.isSafeInteger(message[key]) || message[key] < 0)) ||
    (message.code !== undefined && message.code !== 'invalid-response' && !Number.isSafeInteger(message.code))) {
    throw new Error('[smoke] invalid diagnostic IPC message');
  }
  const details = [];
  if (message.reason) details.push(reasons[message.reason]);
  if (message.http !== undefined) details.push(`http=${message.http}`);
  if (message.code !== undefined) details.push(`code=${message.code}`);
  if (message.bytes !== undefined) details.push(`bytes=${message.bytes}`);
  if (message.timeoutMs !== undefined) details.push(`timeout_ms=${message.timeoutMs}`);
  return `[${message.passed ? 'PASS' : 'FAIL'}] ${checks[message.check]}${details.length ? ' | ' + details.join(', ') : ''}`;
}

export class SmokeCheckError extends Error {
  constructor(check, reason, details = {}) {
    const diagnostic = {type:'smoke-status',version:1,check,passed:false,reason,...details};
    super(formatSmokeDiagnostic(diagnostic));
    this.diagnostic = diagnostic;
  }
}

export async function sendSmokeDiagnostic(message) {
  const text = formatSmokeDiagnostic(message);
  if (typeof process.send !== 'function') {
    (message.passed ? process.stdout : process.stderr).write(text + '\n');
    return;
  }
  await new Promise((resolve,reject) => process.send(message,error => error ? reject(new Error('[smoke] parent IPC disconnected')) : resolve()));
}

export function runSmokeChecks({env = process.env, cwd, authentication = false, timeoutMs = 120000, signal,
  modulePath = fileURLToPath(new URL('./smoke_checks.mjs', import.meta.url)), onDiagnostic = text => process.stdout.write(text + '\n'), onState = () => {}} = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 900000) throw new Error('[smoke] invalid IPC timeout');
  if (env.PRINT_TOKEN !== undefined || env.PRINT_USER_ID !== undefined) throw new SmokeCheckError('configuration','legacy-output');
  if (signal?.aborted) return Promise.reject(new Error('[smoke] IPC interrupted before start'));
  return new Promise((resolve,reject) => {
    const child = fork(modulePath, [], {cwd,env:{...env,SMOKE_AUTH_IPC:authentication ? '1' : '0'},
      stdio:['ignore','pipe','pipe','ipc'],detached:process.platform !== 'win32',windowsHide:true});
    let auth, failure, stopPromise, complete = false;
    const passed = new Set();
    const stop = reason => {
      if (stopPromise) return;
      failure = new Error(`[smoke] ${reason}`);
      stopPromise = child.pid ? terminateProcessTree(child.pid,{graceMs:40}).catch(() => {
        failure = new Error('[smoke] owned IPC process cleanup failed');
        try { onState({pid:child.pid,port:null,log:null,owned:true,status:'failed'}); }
        catch { failure = new Error('[smoke] owned IPC cleanup failed; cannot record state'); }
        clearTimeout(timer);
        signal?.removeEventListener('abort',onAbort);
        reject(failure);
      }) : Promise.resolve();
    };
    const onAbort = () => stop('IPC interrupted');
    const timer = setTimeout(() => stop('IPC timed out'),timeoutMs);
    try { onState({pid:child.pid,port:null,log:null,owned:true,status:'running'}); } catch { stop('cannot record owned IPC state'); }
    signal?.addEventListener('abort',onAbort,{once:true});
    if (signal?.aborted) onAbort();
    child.on('error',() => stop('IPC child failed to start'));
    // This channel is never a log transport, including unexpected output from dependencies.
    child.stdout.on('data',() => stop('unexpected child stdout'));
    child.stderr.on('data',() => stop('unexpected child stderr'));
    child.on('message',message => {
      if (failure) return;
      try {
        if (message?.type === 'smoke-status') {
          const text = formatSmokeDiagnostic(message);
          if (complete || (message.passed && passed.has(message.check)) ||
            (message.passed && message.check !== 'complete' && !requiredChecks.includes(message.check))) throw new Error('invalid status');
          if (message.passed && message.check === 'complete') {
            if (!requiredChecks.every(check=>passed.has(check)) || (authentication && !auth)) throw new Error('incomplete checks');
            complete = true;
          } else if (message.passed) passed.add(message.check);
          if (!message.passed) failure = new Error(text);
          onDiagnostic(text);
          return;
        }
        if (!authentication || auth || complete || !message || message.type !== 'smoke-auth' || message.version !== 1 ||
          Object.keys(message).sort().join(',') !== 'token,type,userId,version' ||
          typeof message.token !== 'string' || !message.token || message.token.length > 16384 || /[\s\x00-\x1f\x7f]/u.test(message.token) ||
          typeof message.userId !== 'string' || !/^[1-9]\d{0,19}$/u.test(message.userId)) {
          throw new Error('invalid authentication');
        }
        auth = {token:message.token,userId:message.userId};
      } catch { stop('invalid or duplicate IPC message'); }
    });
    child.on('close',async(code,childSignal) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort',onAbort);
      await stopPromise;
      try {
        onState({pid:child.pid,port:null,log:null,owned:true,status:failure || childSignal || code !== 0 || !complete || (authentication && !auth) ? 'failed' : 'passed'});
      } catch { failure = new Error('[smoke] cannot record closed IPC state'); }
      if (failure) reject(failure);
      else if (childSignal || code !== 0) reject(new Error('[smoke] IPC child failed'));
      else if (authentication && !auth) reject(new Error('[smoke] missing authentication IPC message'));
      else if (!complete) reject(new Error('[smoke] missing completed IPC checks'));
      else resolve(auth);
    });
  });
}
