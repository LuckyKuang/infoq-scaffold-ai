#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
try {
  const runId=process.env.ACCEPTANCE_RUN_ID;
  if(!/^[a-z][a-z0-9-]{2,21}$/.test(runId || ''))throw Error('ACCEPTANCE_RUN_ID invalid');
  const state=JSON.parse(fs.readFileSync(path.join(repo,'tmp/production-readiness',`linux-${runId}`,'acceptance.state.json'),'utf8'));
  if(state.status!=='passed' || state.cleanup?.status!=='verified' || !state.cleanup.browserClosed || !state.cleanup.ownedProjectsRemoved)throw Error('acceptance/owned cleanup not passed');
  console.log('[linux-acceptance] actual run and cleanup evidence passed');
}catch(error){console.error(`[linux-acceptance] ${error.message}`);process.exitCode=1;}
