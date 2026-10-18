import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import {
  bindBrowserSession,
  browserSessionRequest,
  clearBrowserSessionCsrf,
  deleteBrowserSession,
  restoreBrowserSession
} from '@/api/browser-session';
import { setToken, removeToken } from '@/utils/auth';
import { getToken } from '@/utils/auth';
import * as loginApi from '@/api/login';
import { useUserStore } from '@/store/modules/user';
import type { LoginData } from '@/api/types';

let requests: InternalAxiosRequestConfig[] = [];
let reply: (config: InternalAxiosRequestConfig) => { status: number; data: unknown };
beforeEach(() => {
  useUserStore.getState().invalidateSession();
  useUserStore.setState({ logoutState: 'idle' });
  clearBrowserSessionCsrf();
  removeToken();
  sessionStorage.clear();
  vi.stubEnv('VITE_APP_CLIENT_ID', 'test-client');
  browserSessionRequest.defaults.baseURL = '/test-api';
  requests = [];
  reply = (config) => ({
    status: 200,
    data: {
      code: 200,
      data: config.url?.endsWith('/csrf')
        ? { token: 'csrf-fixture', headerName: 'X-XSRF-TOKEN' }
        : config.method === 'post'
          ? { access_token: 'restored-token', client_id: 'test-client', expire_in: 60 }
          : null
    }
  });
  browserSessionRequest.defaults.adapter = async (config) => {
    requests.push(config);
    return { ...reply(config), config, headers: {}, statusText: 'fixture' };
  };
});

describe('api/browser-session narrow protocol', () => {
  it('bootstraps CSRF and binds only the explicit new bearer without storing request bodies', async () => {
    setToken('expired-old-token');
    await bindBrowserSession('new-token');
    expect(requests.map(({ method, url }) => [method, url])).toEqual([
      ['get', '/auth/browser-session/csrf'],
      ['put', '/auth/browser-session']
    ]);
    expect(requests[0].headers.Authorization).toBeUndefined();
    expect(requests[1].headers.Authorization).toBe('Bearer new-token');
    expect(requests[1].headers['X-XSRF-TOKEN']).toBe('csrf-fixture');
    expect(requests[1].headers['X-InfoQ-Browser-Session']).toBe('react');
    expect(requests[1].headers.clientid).toBe('test-client');
    expect(sessionStorage.getItem('sessionObj')).toBeNull();
  });

  it('restores and deletes without bearer and reboots CSRF after deletion', async () => {
    setToken('must-not-send');
    await expect(restoreBrowserSession()).resolves.toMatchObject({ access_token: 'restored-token' });
    await deleteBrowserSession();
    expect(requests).toHaveLength(3);
    expect(requests.every(({ headers }) => headers.Authorization === undefined)).toBe(true);
    await bindBrowserSession('next-token');
    expect(requests.filter(({ method }) => method === 'get')).toHaveLength(2);
  });

  it('shares a pending CSRF bootstrap', async () => {
    await Promise.all([bindBrowserSession('one'), bindBrowserSession('two')]);
    expect(requests.filter(({ method }) => method === 'get')).toHaveLength(1);
  });

  it.each([200, 503])('waits for a pending DELETE %s response before binding a new store login', async (deleteStatus) => {
    let cookie = 'old-recovery-cookie';
    let finishDelete!: () => void;
    const login = vi.spyOn(loginApi, 'login').mockResolvedValue({ code: 200, data: { access_token: 'new-login-token' } });
    browserSessionRequest.defaults.adapter = async (config) => {
      requests.push(config);
      if (config.method === 'delete') {
        return new Promise((resolve) => {
          finishDelete = () => {
            cookie = '';
            resolve({ config, status: deleteStatus, data: { code: deleteStatus }, headers: {}, statusText: 'fixture' });
          };
        });
      }
      if (config.method === 'put') cookie = 'new-recovery-cookie';
      return { ...reply(config), config, headers: {}, statusText: 'fixture' };
    };
    const logout = useUserStore.getState().logout();
    const logoutResult = deleteStatus === 200 ? expect(logout).resolves.toBeUndefined() : expect(logout).rejects.toMatchObject({ status: 503 });
    await vi.waitFor(() => expect(finishDelete).toBeTypeOf('function'));
    const nextLogin = useUserStore.getState().login({ username: 'admin', password: 'test-only' } as LoginData);
    await vi.waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    expect(requests.some(({ method }) => method === 'put')).toBe(false);
    expect(getToken()).toBe('');
    finishDelete();
    await logoutResult;
    await nextLogin;
    expect(cookie).toBe('new-recovery-cookie');
    expect(getToken()).toBe('new-login-token');
    expect(requests.map(({ method }) => method)).toEqual(['get', 'delete', 'get', 'put']);
  });

  it.each([true, false])('reboots CSRF after restore 401 clears both cookies before binding (queued=%s)', async (queued) => {
    let cookie = 'expired-recovery-cookie';
    let csrfCookie = '';
    let csrfGeneration = 0;
    let finishRestore!: () => void;
    browserSessionRequest.defaults.adapter = async (config) => {
      requests.push(config);
      if (config.method === 'get') {
        csrfCookie = `csrf-fixture-${++csrfGeneration}`;
        return {
          config,
          status: 200,
          data: { code: 200, data: { token: csrfCookie, headerName: 'X-XSRF-TOKEN' } },
          headers: {},
          statusText: 'fixture'
        };
      }
      if (!csrfCookie || config.headers['X-XSRF-TOKEN'] !== csrfCookie) {
        return { config, status: 403, data: { code: 403 }, headers: {}, statusText: 'fixture' };
      }
      if (config.method === 'post') {
        return new Promise((resolve) => {
          finishRestore = () => {
            cookie = '';
            csrfCookie = '';
            resolve({ config, status: 401, data: { code: 401 }, headers: {}, statusText: 'fixture' });
          };
        });
      }
      if (config.method === 'put') cookie = 'new-recovery-cookie';
      return { ...reply(config), config, headers: {}, statusText: 'fixture' };
    };
    const restore = restoreBrowserSession();
    const rejected = expect(restore).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(finishRestore).toBeTypeOf('function'));
    const bind = queued ? expect(bindBrowserSession('new-token')).resolves.toBeUndefined() : undefined;
    await Promise.resolve();
    expect(requests.some(({ method }) => method === 'put')).toBe(false);
    finishRestore();
    await rejected;
    if (bind) await bind;
    else await bindBrowserSession('new-token');
    expect(cookie).toBe('new-recovery-cookie');
    expect(csrfGeneration).toBe(2);
    expect(requests.map(({ method }) => method)).toEqual(['get', 'post', 'get', 'put']);
  });

  it.each([403, 503])('preserves CSRF after restore %s and does not retry the failed operation', async (status) => {
    const normal = reply;
    reply = (config) => (config.method === 'post' ? { status, data: { code: status } } : normal(config));
    const restored = expect(restoreBrowserSession()).rejects.toMatchObject({ status });
    const binding = bindBrowserSession('new-token');
    await restored;
    await binding;
    expect(requests.map(({ method }) => method)).toEqual(['get', 'post', 'put']);
    expect(requests[2].headers['X-XSRF-TOKEN']).toBe('csrf-fixture');
  });

  it.each([401, 403, 503])('preserves HTTP error %s for explicit caller classification', async (status) => {
    const normal = reply;
    reply = (config) => (config.method === 'get' ? normal(config) : { status, data: { code: status } });
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status });
  });

  it('rejects HTTP200/business failures and inconsistent restore contracts', async () => {
    const normal = reply;
    reply = (config) => (config.method === 'get' ? normal(config) : { status: 200, data: { code: 503 } });
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status: 0 });
    reply = (config) =>
      config.method === 'get'
        ? normal(config)
        : { status: 200, data: { code: 200, data: { access_token: 'wrong-client', client_id: 'different', expire_in: 60 } } };
    await expect(restoreBrowserSession()).rejects.toThrow('恢复响应无效');
  });

  it('fails network requests explicitly without retrying or using business auth interceptors', async () => {
    browserSessionRequest.defaults.adapter = async () => {
      throw new Error('Network Error');
    };
    await expect(restoreBrowserSession()).rejects.toMatchObject({ status: 0 });
  });

  it.each(['https://other.example/api', '//other.example/api', '/api/../outside'])(
    'rejects unsafe API target %s before sending credentials',
    async (baseURL) => {
      browserSessionRequest.defaults.baseURL = baseURL;
      await expect(bindBrowserSession('new-bearer')).rejects.toThrow('同源 API 代理前缀');
      expect(requests).toHaveLength(0);
    }
  );
});
