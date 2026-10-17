import net from 'node:net';
import tls from 'node:tls';

export const DEFAULT_CAPTCHA_KEY_PREFIX = 'global:captcha_codes:';
export const DEFAULT_CAPTCHA_TTL_MS = 120000;

export function encodeCommand(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new Error('Redis command must be a non-empty array.');
  }
  const parts = [`*${args.length}\r\n`];
  for (const arg of args) {
    const value = String(arg);
    parts.push(`$${Buffer.byteLength(value)}\r\n${value}\r\n`);
  }
  return parts.join('');
}

function parseAt(buffer, offset) {
  if (offset >= buffer.length) {
    return null;
  }
  const type = String.fromCharCode(buffer[offset]);
  const lineEnd = buffer.indexOf('\r\n', offset + 1);
  if (lineEnd < 0) {
    return null;
  }
  const line = buffer.toString('utf8', offset + 1, lineEnd);
  const next = lineEnd + 2;

  switch (type) {
    case '+':
      return {value: line, next};
    case '-':
      return {error: line, next};
    case ':':
      return {value: Number(line), next};
    case '$': {
      const length = Number(line);
      if (length === -1) {
        return {value: null, next};
      }
      if (!Number.isInteger(length) || length < 0) {
        return {error: `Invalid bulk length: ${line}`, next};
      }
      if (buffer.length < next + length + 2) {
        return null;
      }
      return {value: buffer.toString('utf8', next, next + length), next: next + length + 2};
    }
    case '*': {
      const count = Number(line);
      if (count === -1) {
        return {value: null, next};
      }
      if (!Number.isInteger(count) || count < 0) {
        return {error: `Invalid array length: ${line}`, next};
      }
      const values = [];
      let cursor = next;
      for (let index = 0; index < count; index += 1) {
        const item = parseAt(buffer, cursor);
        if (!item) {
          return null;
        }
        if (item.error) {
          return item;
        }
        values.push(item.value);
        cursor = item.next;
      }
      return {value: values, next: cursor};
    }
    default:
      return {error: `Unsupported RESP type: ${type}`, next};
  }
}

export function parseRespValue(buffer, offset = 0) {
  const parsed = parseAt(buffer, offset);
  if (!parsed) {
    return null;
  }
  if (parsed.error) {
    throw new Error(`Redis error: ${parsed.error}`);
  }
  return {value: parsed.value, nextOffset: parsed.next};
}

export class RedisClient {
  constructor(options = {}) {
    this.host = options.host ?? '127.0.0.1';
    this.port = Number(options.port ?? 6379);
    this.username = options.username ?? '';
    this.password = options.password ?? '';
    this.tls = Boolean(options.tls);
    this.timeoutMs = Number(options.timeoutMs ?? 5000);
    this.socket = null;
    this.buffer = Buffer.alloc(0);
    this.pending = [];
    this.closed = false;
  }

  connect() {
    if (this.socket) {
      return Promise.resolve();
    }
    if (!Number.isInteger(this.port) || this.port <= 0 || this.port > 65535) {
      return Promise.reject(new Error(`Invalid Redis port: ${this.port}`));
    }
    return new Promise((resolve, reject) => {
      const socket = this.tls
        ? tls.connect({host: this.host, port: this.port, servername: this.host})
        : net.createConnection({host: this.host, port: this.port});
      this.socket = socket;
      socket.setNoDelay(true);
      socket.setTimeout(this.timeoutMs);
      const eventName = this.tls ? 'secureConnect' : 'connect';
      const onConnect = () => {
        resolve();
      };
      const onError = (error) => {
        this.failPending(error);
        reject(error);
      };
      const onTimeout = () => {
        const error = new Error(`Redis connection timed out after ${this.timeoutMs}ms.`);
        this.failPending(error);
        socket.destroy();
        reject(error);
      };
      socket.once(eventName, onConnect);
      socket.once('error', onError);
      socket.once('timeout', onTimeout);
      socket.on('data', (chunk) => this.onData(chunk));
      socket.on('close', () => {
        this.closed = true;
        this.failPending(new Error('Redis connection closed.'));
      });
    });
  }

  onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.pending.length > 0) {
      let parsed;
      try {
        parsed = parseRespValue(this.buffer, 0);
      } catch (error) {
        const pending = this.pending.shift();
        pending.reject(error);
        this.buffer = Buffer.alloc(0);
        continue;
      }
      if (!parsed) {
        return;
      }
      this.buffer = this.buffer.subarray(parsed.nextOffset);
      const pending = this.pending.shift();
      pending.resolve(parsed.value);
    }
  }

  failPending(error) {
    while (this.pending.length > 0) {
      this.pending.shift().reject(error);
    }
  }

  command(args) {
    if (!this.socket) {
      return Promise.reject(new Error('Redis client is not connected.'));
    }
    return new Promise((resolve, reject) => {
      this.pending.push({resolve, reject});
      this.socket.write(encodeCommand(args), (error) => {
        if (error) {
          const pending = this.pending.shift();
          pending?.reject(error);
        }
      });
    });
  }

  async close() {
    if (!this.socket || this.closed) {
      return;
    }
    const socket = this.socket;
    this.socket = null;
    await new Promise((resolve) => {
      socket.once('close', resolve);
      socket.end();
      setTimeout(() => {
        socket.destroy();
        resolve();
      }, 1000).unref();
    });
  }
}

export function normalizeRedisOptions(options = {}) {
  const port = Number(options.port ?? 6379);
  const database = Number(options.database ?? 0);
  const ttlMs = Number(options.ttlMs ?? DEFAULT_CAPTCHA_TTL_MS);
  const timeoutMs = Number(options.timeoutMs ?? 5000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid Redis port: ${options.port}`);
  }
  if (!Number.isInteger(database) || database < 0) {
    throw new Error(`Invalid Redis database: ${options.database}`);
  }
  if (!Number.isInteger(ttlMs) || ttlMs <= 0) {
    throw new Error(`Invalid captcha TTL: ${options.ttlMs}`);
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`Invalid Redis timeout: ${options.timeoutMs}`);
  }
  return {
    host: options.host || '127.0.0.1',
    port,
    username: options.username || '',
    password: options.password || '',
    database,
    tls: Boolean(options.tls),
    ttlMs,
    timeoutMs,
    keyPrefix: options.keyPrefix || DEFAULT_CAPTCHA_KEY_PREFIX,
  };
}

export async function seedCaptchaAnswer(options = {}) {
  const redis = normalizeRedisOptions(options);
  const uuid = String(options.uuid || '').trim();
  const answer = String(options.answer ?? '').trim();
  if (!uuid) {
    throw new Error('Captcha uuid is required for Redis seeding.');
  }
  if (!answer) {
    throw new Error('Captcha answer is required for Redis seeding.');
  }

  const client = new RedisClient(redis);
  await client.connect();
  try {
    if (redis.password) {
      const authArgs = redis.username ? ['AUTH', redis.username, redis.password] : ['AUTH', redis.password];
      await client.command(authArgs);
    }
    if (redis.database !== 0) {
      await client.command(['SELECT', String(redis.database)]);
    }
    const key = `${redis.keyPrefix}${uuid}`;
    // Redisson uses TypedJsonJacksonCodec for values; a JSON string keeps the
    // decoded value a String instead of a number.
    const value = JSON.stringify(answer);
    await client.command(['SET', key, value, 'PX', String(redis.ttlMs)]);
    return {key, ttlMs: redis.ttlMs, host: redis.host, port: redis.port, database: redis.database};
  } finally {
    await client.close();
  }
}
