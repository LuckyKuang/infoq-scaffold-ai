import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';

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
  waitForText = '',
  waitForUrl = '',
  screenshotPath = '',
  consoleLogPath = '',
  failOnConsoleErrors = true,
  timeoutMs = 45000,
  headed = false,
  ignoreHTTPSErrors = false
}) {
  if (!targetUrl) {
    throw new Error('targetUrl is required.');
  }

  const consoleEntries = [];
  const normalizedWaitForUrl = normalizeWaitPattern(waitForUrl);
  let browser;

  try {
    browser = await chromium.launch({
      headless: !headed
    });

    const context = await browser.newContext({
      ignoreHTTPSErrors,
      viewport: { width: 1440, height: 900 }
    });

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
      consoleEntries.push({
        type: message.type(),
        text: message.text()
      });
    });

    page.on('pageerror', (error) => {
      consoleEntries.push({
        type: 'pageerror',
        text: error.message
      });
    });

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: timeoutMs
    });

    if (normalizedWaitForUrl) {
      await page.waitForURL(normalizedWaitForUrl, { timeout: timeoutMs });
    }

    if (waitForText) {
      await page.getByText(waitForText, { exact: false }).waitFor({ timeout: timeoutMs });
    }

    try {
      await page.waitForLoadState('networkidle', { timeout: timeoutMs });
    } catch {
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

    return {
      consoleEntries,
      screenshotPath,
      consoleLogPath
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
