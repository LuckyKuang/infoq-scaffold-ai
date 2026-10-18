import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
import {markRunState, resolveRepoRoot, resolveTmpPath} from '../../../tools/lib/skill_runtime.mjs';
import {establishBrowserSession} from '../../../tools/lib/browser_session.mjs';
import {createBrowserEvidence} from '../../../tools/lib/browser_evidence.mjs';

export function ensureParentDir(filePath) {
  if (!filePath) {
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function normalizeWaitPattern(value) {
  if (!value) {
    return '';
  }
  if (value.includes('*')) {
    return value;
  }
  return `**${value}`;
}

export async function runPlaywrightFlow({
  targetUrl,
  storageKey = 'Admin-Token',
  storageValue = '',
  browserSession,
  waitForText = '',
  waitForUrl = '',
  screenshotPath = '',
  consoleLogPath = '',
  failOnConsoleErrors = true,
  timeoutMs = 45000,
  headed = false,
  ignoreHTTPSErrors = false,
  signal: parentSignal
}) {
  if (!targetUrl) {
    throw new Error('targetUrl is required.');
  }
  if (storageValue && storageKey === 'Admin-Token') {
    throw new Error('Admin-Token storage injection is no longer supported; establish a browser session.');
  }

  const evidence = createBrowserEvidence([browserSession?.token]);
  const consoleEntries = [];
  const normalizedWaitForUrl = normalizeWaitPattern(waitForUrl);
  let browser;
  let closePromise;
  let failure;
  const controller = new AbortController();
  const signal = parentSignal || controller.signal;
  const handlers = new Map(['SIGINT', 'SIGTERM', 'SIGHUP'].map((name) => [name, () => {
    controller.abort(new Error(`Interrupted by ${name}`));
    process.exitCode = name === 'SIGINT' ? 130 : name === 'SIGHUP' ? 129 : 143;
  }]));
  if (!parentSignal) for (const [name, handler] of handlers) process.on(name, handler);
  const closeBrowser = () => {
    if (browser) closePromise ||= browser.close();
    return closePromise;
  };
  const interrupt = () => { void closeBrowser()?.catch(() => undefined); };
  signal.addEventListener('abort', interrupt, {once: true});
  const repoRoot = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
  const stateFile = resolveTmpPath(repoRoot, 'test-cli', 'browser', 'states', `${Date.now()}-${process.pid}-${crypto.randomUUID()}.json`);
  if (!consoleLogPath) consoleLogPath = stateFile.replace(/\.json$/u, '.console.json');
  markRunState(stateFile, evidence.sanitize({status: 'starting', pid: process.pid, port: null, log: consoleLogPath, transport: 'pipe', owned: true, browserClosed: false}));

  try {
    signal.throwIfAborted();
    browser = await chromium.launch({
      headless: !headed, timeout: timeoutMs,
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false
    });
    signal.throwIfAborted();
    markRunState(stateFile, {status: 'running'});

    const context = await browser.newContext({
      ignoreHTTPSErrors,
      viewport: { width: 1440, height: 900 }
    });

    if (browserSession) await establishBrowserSession(context, {...browserSession, origin: targetUrl});

    if (storageValue) {
      await context.addInitScript(
        ({ key, value }) => {
          window.localStorage.setItem(key, value);
        },
        { key: storageKey, value: storageValue }
      );
    }

    const page = await context.newPage();

    page.on('console', (message) => {
      consoleEntries.push(evidence.sanitize({
        type: message.type(),
        text: message.text(),
        location: message.location()
      }));
    });

    page.on('pageerror', (error) => {
      consoleEntries.push(evidence.sanitize({
        type: 'pageerror',
        text: error.message
      }));
    });

    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs
    });
    if (response && !response.ok()) throw new Error(`Page navigation failed: HTTP ${response.status()}`);

    if (normalizedWaitForUrl) {
      await page.waitForURL(normalizedWaitForUrl, { timeout: timeoutMs });
    }

    if (waitForText) {
      await page.getByText(waitForText, { exact: false }).waitFor({ timeout: timeoutMs });
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: timeoutMs });
    } catch {
      signal.throwIfAborted();
      // Some SPA routes keep background requests alive; keep evidence instead of failing here.
    }

    if (screenshotPath) {
      ensureParentDir(screenshotPath);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true
      });
    }

    if (consoleLogPath) {
      ensureParentDir(consoleLogPath);
      fs.writeFileSync(consoleLogPath, `${JSON.stringify(consoleEntries, null, 2)}\n`, 'utf8');
    }

    const consoleErrors = consoleEntries.filter((entry) => entry.type === 'error' || entry.type === 'pageerror');
    if (failOnConsoleErrors && consoleErrors.length > 0) {
      throw new Error(
        `Console check failed with ${consoleErrors.length} error entries. See ${consoleLogPath || 'captured console output'}.`
      );
    }

    return evidence.sanitize({
      consoleEntries,
      screenshotPath,
      consoleLogPath,
      stateFile
    });
  } catch (error) {
    failure = evidence.error(error);
    throw failure;
  } finally {
    signal.removeEventListener('abort', interrupt);
    let closeError;
    try { await closeBrowser(); } catch (error) { closeError = evidence.error(error); }
    try {
      ensureParentDir(consoleLogPath);
      fs.writeFileSync(consoleLogPath, `${JSON.stringify(consoleEntries, null, 2)}\n`, 'utf8');
      markRunState(stateFile, evidence.sanitize({status: signal.aborted ? 'interrupted' : (failure || closeError) ? 'failed' : 'passed', browserClosed: !closeError, error: (signal.aborted ? signal.reason : failure || closeError)?.message || '', cleanupError: closeError?.message || ''}));
    } finally {
      if (!parentSignal) for (const [name, handler] of handlers) process.removeListener(name, handler);
    }
    if (closeError) throw new AggregateError([failure, closeError].filter(Boolean), [failure?.message, `Browser cleanup failed: ${closeError.message}`].filter(Boolean).join('; '));
    if (!failure && signal.aborted) throw evidence.error(signal.reason);
  }
}
