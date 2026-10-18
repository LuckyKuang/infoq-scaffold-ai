#!/usr/bin/env node
// NUL-delimited private pipe consumed by shell helpers; never invoke for diagnostics.
import {readProductionConfig, runtimeConfigEntries} from '../../tools/production_config.mjs';

try {
  if (process.argv.length > 3) throw new Error('环境加载器参数无效');
  const file = process.argv[2];
  const config = file ? readProductionConfig(file) : {};
  const productionFile = config.INFOQ_PRODUCTION_CONFIG_FILE || process.env.INFOQ_PRODUCTION_CONFIG_FILE;
  const values = productionFile && productionFile !== file ? {...config, ...readProductionConfig(productionFile)} : config;
  const entries = runtimeConfigEntries(values);
  for (const [key, value] of entries) process.stdout.write(`${key}\0${value}\0`);
  process.stdout.write('INFOQ_ENV_LOAD_COMPLETE\0true\0');
} catch (error) { console.error(`[deploy-env] ${error.message}`); process.exitCode = 1; }
