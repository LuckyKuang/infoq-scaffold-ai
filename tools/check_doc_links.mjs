#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveRepoRoot} from './lib/skill_runtime.mjs';

const excludedDirectories = new Set([
  '.git', 'node_modules', 'target', 'dist', 'build', 'coverage', 'tmp', 'logs',
  '.pnpm-store', '.idea', '.cache', '.gradle', '.next', '.nuxt', '.output',
  '.vite', '.swc', '.history', '.playwright-mcp', '__pycache__', 'test-results', 'playwright-report',
]);
const help = `Usage: node tools/check_doc_links.mjs [--root <git-repository>] [--json]

Checks tracked and nonignored untracked .md/.markdown files, including hidden maintenance directories.
Excludes generated/dependency directory components: ${[...excludedDirectories].join(', ')}; openspec/changes/.
Supports inline/image links, full/collapsed/defined shortcut references, balanced/escaped parentheses,
angle/URL-encoded paths, ATX/Setext heading anchors (including duplicates), HTML id/name and href/src.
Paths beginning with / resolve from the repository root; other paths resolve from the source document.
Code fences, code spans, indented code, HTML comments and pre/code blocks are ignored.
External URLs are counted but never fetched. Template targets are reported as skipped, never validated.
Fragments are checked for Markdown/HTML targets only; other fragment targets are reported as unchecked.
This is a static repository checker, not a complete CommonMark renderer: complex nested block/list syntax,
MDX/directives, generated site anchors and renderer-specific heading attributes require separate review.
Named HTML entities support amp/lt/gt/quot/apos/nbsp and numeric forms.
Undefined explicit reference links fail; undefined shortcut text remains ordinary Markdown text.
--json emits the inventory, counts, skipped targets and failures. Unknown/missing arguments fail.
`;

function mask(text) {
  return text.replace(/[^\n\r]/g, ' ');
}

function withoutCode(text) {
  const ticks = new Map(backtickRuns(text).map((run, index, runs) => [run.start, {...run, closing: runs[run.closing]}]));
  const parts = [];
  let offset = 0;
  let fence = null;
  for (let index = 0; index < text.length;) {
    let end;
    if (index === 0 || text[index - 1] === '\n') {
      const lineEnd = text.indexOf('\n', index);
      const line = text.slice(index, lineEnd < 0 ? text.length : lineEnd);
      const opening = /^ {0,3}(?:> ?)*(`{3,}|~{3,})(.*)$/u.exec(line);
      if (fence) {
        if (opening && opening[1][0] === fence.character && opening[1].length >= fence.length && !opening[2].trim()) fence = null;
        end = index + line.length + (lineEnd < 0 ? 0 : 1);
      } else if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
        fence = {character: opening[1][0], length: opening[1].length};
        end = index + line.length + (lineEnd < 0 ? 0 : 1);
      } else if (/^(?: {4}|\t)/u.test(line)) {
        end = index + line.length + (lineEnd < 0 ? 0 : 1);
      }
    }
    if (end === undefined && text.startsWith('<!--', index)) {
      const closing = text.indexOf('-->', index + 4);
      end = closing < 0 ? text.length : closing + 3;
    }
    if (end === undefined && text[index] === '<') {
      const opening = /^<(pre|code)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/iu.exec(text.slice(index));
      if (opening) {
        const closing = new RegExp(`</${opening[1]}\\s*>`, 'giu');
        closing.lastIndex = index + opening[0].length;
        const match = closing.exec(text);
        end = match ? match.index + match[0].length : text.length;
      }
    }
    if (end !== undefined) {
      parts.push(text.slice(offset, index), mask(text.slice(index, end)));
      offset = end;
      index = end;
      continue;
    }
    if (text[index] === '\\') { index += 2; continue; }
    const tick = ticks.get(index);
    if (tick?.closing && !tick.escaped) { index = tick.closing.end; continue; }
    index += 1;
  }
  parts.push(text.slice(offset));
  return parts.join('');
}

function backtickRuns(text) {
  const runs = [];
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\') { escaped = !escaped; continue; }
    if (text[index] !== '`') { escaped = false; continue; }
    const start = index;
    while (text[index + 1] === '`') index += 1;
    runs.push({start, end: index + 1, length: index + 1 - start, escaped});
    escaped = false;
  }
  const next = new Map();
  for (let index = runs.length - 1; index >= 0; index -= 1) {
    runs[index].closing = next.get(runs[index].length);
    next.set(runs[index].length, index);
  }
  return runs;
}

function withoutCodeSpans(text) {
  const runs = backtickRuns(text);
  const parts = [];
  let offset = 0;
  for (let index = 0; index < runs.length; index += 1) {
    const opening = runs[index];
    if (opening.escaped || opening.closing === undefined) continue;
    const closing = runs[opening.closing];
    parts.push(text.slice(offset, opening.start), mask(text.slice(opening.start, closing.end)));
    offset = closing.end;
    index = opening.closing;
  }
  parts.push(text.slice(offset));
  return parts.join('');
}

function unescapeMarkdown(text) {
  return text.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~ ])/gu, '$1');
}

function decodeEntities(text) {
  const named = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0'};
  return text.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/giu, (original, entity) => {
    if (!entity.startsWith('#')) return named[entity.toLowerCase()];
    const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}

function bracketPairs(text) {
  const openings = [];
  const pairs = new Map();
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\\') { index += 1; continue; }
    if (text[index] === '[') openings.push(index);
    if (text[index] === ']' && openings.length) pairs.set(openings.pop(), index);
  }
  return pairs;
}

// Share the destination grammar between definitions and inline links; preserve balanced parentheses.
function destination(text, start, inline) {
  let index = start;
  while (/\s/u.test(text[index] ?? '') && index < text.length) index += 1;
  const begin = index;
  let target;
  if (text[index] === '<') {
    index += 1;
    const valueStart = index;
    while (index < text.length && text[index] !== '>' && text[index] !== '\n') {
      if (text[index] === '\\') index += 1;
      index += 1;
    }
    if (text[index] !== '>') return null;
    target = text.slice(valueStart, index++);
  } else {
    let depth = 0;
    while (index < text.length) {
      const character = text[index];
      if (character === '\\' && index + 1 < text.length) { index += 2; continue; }
      if (/\s/u.test(character)) break;
      if (character === '(') depth += 1;
      if (character === ')') {
        if (depth === 0) break;
        depth -= 1;
      }
      index += 1;
    }
    if (depth !== 0) return null;
    target = text.slice(begin, index);
  }
  if (!inline) return target ? {target, end: index} : null;
  const beforeWhitespace = index;
  while (index < text.length && /\s/u.test(text[index])) index += 1;
  if (index > beforeWhitespace && ['"', "'", '('].includes(text[index])) {
    const endQuote = text[index] === '(' ? ')' : text[index];
    index += 1;
    while (index < text.length && text[index] !== endQuote) {
      if (text[index] === '\\') index += 1;
      index += 1;
    }
    if (text[index++] !== endQuote) return null;
    while (index < text.length && /\s/u.test(text[index])) index += 1;
  }
  return text[index] === ')' ? {target, end: index + 1} : null;
}

function referenceKey(label) {
  return decodeEntities(unescapeMarkdown(label)).trim().replace(/\s+/gu, ' ').toLowerCase();
}

function htmlTags(text, markdown = true) {
  return [...text.matchAll(/<([a-z][\w:-]*)(?=[\s/>])(?:[^"'<>]|"[^"]*"|'[^']*')*>/giu)].flatMap((match) => {
    let preceding = match.index;
    while (preceding > 0 && text[preceding - 1] === '\\') preceding -= 1;
    if (markdown && (match.index - preceding) % 2 !== 0) return [];
    const attributes = new Map();
    for (const attribute of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu)) {
      attributes.set(attribute[1].toLowerCase(), decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4]));
    }
    return [{index: match.index, end: match.index + match[0].length, tag: match[1].toLowerCase(), attributes}];
  });
}

function headingText(text) {
  const inlineText = text
    .replace(/!?\[([^\]]*)\]\((?:[^()]|\([^()]*\))*\)/gu, '$1')
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/gu, '$1');
  const parts = [];
  let start = 0;
  const ticks = backtickRuns(inlineText);
  const codeSpans = new Map(ticks.filter(tick => !tick.escaped && tick.closing !== undefined).map(tick => [tick.start,ticks[tick.closing].end]));
  // Extract heading text for anchor indexing; this is not an HTML sanitizer or renderer.
  for (let index = 0; index < inlineText.length; index += 1) {
    if (inlineText[index] === '\\') { index += 1; continue; }
    if (codeSpans.has(index)) { index = codeSpans.get(index) - 1; continue; }
    if (inlineText[index] !== '<' || !/^<\/?[a-z][\w:-]*(?=[\s/>])/iu.test(inlineText.slice(index))) continue;
    let quote = '';
    let end = index + 1;
    for (; end < inlineText.length; end += 1) {
      const character = inlineText[end];
      if (quote) { if (character === quote) quote = ''; }
      else if (character === '"' || character === "'") quote = character;
      else if (character === '>') break;
      else if (character === '<') break;
    }
    if (end === inlineText.length) break;
    if (inlineText[end] !== '>') { index = end - 1; continue; }
    parts.push(inlineText.slice(start, index));
    start = end + 1;
    index = end;
  }
  parts.push(inlineText.slice(start));
  return decodeEntities(unescapeMarkdown(parts.join('')
    .replace(/`+/gu, '')
    .replace(/(\*+|~~)(.*?)\1/gu, '$2')
    .replace(/(^|\s)(_+)(.+?)\2(?=\s|$)/gu, '$1$3')));
}

function anchorsFor(text, markdown) {
  const anchors = new Set();
  for (const {tag, attributes} of htmlTags(markdown ? withoutCodeSpans(text) : text, markdown)) {
    if (attributes.has('id')) anchors.add(attributes.get('id'));
    if (tag === 'a' && attributes.has('name')) anchors.add(attributes.get('name'));
  }
  if (!markdown) return anchors;
  const slugs = new Set();
  const counts = new Map();
  const lines = text.split(/\r?\n/u);
  for (let index = 0; index < lines.length; index += 1) {
    const atx = /^ {0,3}#{1,6}(?:\s+(.+?)\s*#*\s*|\s*)$/u.exec(lines[index]);
    const setext = index + 1 < lines.length && /^ {0,3}(?:=+|-+)\s*$/u.test(lines[index + 1]) && lines[index].trim();
    if (!atx && !setext) continue;
    const base = headingText(atx ? atx[1] ?? '' : lines[index].trim()).toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\p{Zs}_\-\t]/gu, '').replace(/[ \t]/gu, '-');
    let slug = base;
    let count = counts.get(base) ?? 0;
    while (slugs.has(slug)) slug = `${base}-${++count}`;
    counts.set(base, count);
    slugs.add(slug);
    anchors.add(slug);
    if (!atx) index += 1;
  }
  return anchors;
}

function linksIn(text) {
  const references = new Map();
  let searchable = withoutCodeSpans(text);
  searchable = searchable.replace(/^ {0,3}\[((?:\\.|[^\]\\\r\n])+)\]:[ \t]*(?:\r?\n[ \t]*)?[^\n]*/gmu, (line, label) => {
    const parsed = destination(line, line.indexOf('[') + label.length + 3, false);
    if (!parsed) return line;
    const key = referenceKey(label);
    if (!references.has(key)) references.set(key, parsed.target);
    return mask(line);
  });
  const links = [];
  const lineStarts = [0];
  for (let index = 0; index < searchable.length; index += 1) {
    if (searchable[index] === '\n') lineStarts.push(index + 1);
  }
  const lineAt = (offset) => {
    let start = 0;
    let end = lineStarts.length;
    while (start < end) {
      const middle = Math.floor((start + end) / 2);
      if (lineStarts[middle] <= offset) start = middle + 1;
      else end = middle;
    }
    return start;
  };
  const pairs = bracketPairs(searchable);
  const tags = htmlTags(searchable);
  const tagEnds = new Map(tags.map(({index, end}) => [index, end]));
  const destinationEnds = new Map();
  for (let index = 0; index < searchable.length; index += 1) {
    const skipTo = destinationEnds.get(index) ?? tagEnds.get(index);
    if (skipTo !== undefined) { index = skipTo - 1; continue; }
    if (searchable[index] === '\\') { index += 1; continue; }
    if (searchable[index] !== '[') continue;
    const close = pairs.get(index);
    if (close === undefined) continue;
    const label = searchable.slice(index + 1, close);
    let after = close + 1;
    if (searchable[after] === '(') {
      const parsed = destination(searchable, after + 1, true);
      if (parsed) {
        links.push({line: lineAt(index), target: parsed.target});
        destinationEnds.set(after, parsed.end);
      }
      continue;
    }
    while (searchable[after] === ' ' || searchable[after] === '\t') after += 1;
    if (searchable[after] === '\r' && searchable[after + 1] === '\n') after += 1;
    if (searchable[after] === '\n') {
      after += 1;
      while (searchable[after] === ' ' || searchable[after] === '\t') after += 1;
    }
    if (searchable[after] === '[') {
      const end = pairs.get(after);
      if (end !== undefined) {
        const reference = searchable.slice(after + 1, end) || label;
        const target = references.get(referenceKey(reference));
        links.push({line: lineAt(index), target: target ?? reference, ...(target === undefined ? {error: 'undefined reference'} : {})});
        destinationEnds.set(close + 1, end + 1);
        continue;
      }
    }
    const target = references.get(referenceKey(label));
    if (target !== undefined) links.push({line: lineAt(index), target});
  }
  for (const {index, attributes} of tags) {
    for (const attribute of ['href', 'src']) {
      if (attributes.has(attribute)) links.push({line: lineAt(index), target: attributes.get(attribute)});
    }
  }
  return links;
}

function check(root) {
  const discovered = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024})
    .split('\0').filter((file) => /\.(md|markdown)$/iu.test(file)))].sort();
  const files = [];
  const excludedFiles = [];
  for (const file of discovered) {
    const components = file.split('/');
    const excluded = components.slice(0, -1).find((component) => excludedDirectories.has(component));
    const reason = excluded ? `generated/dependency directory: ${excluded}`
      : file.startsWith('openspec/changes/') ? 'local OpenSpec change' : null;
    if (reason) excludedFiles.push({file, reason});
    else if (fs.existsSync(path.join(root, file))) files.push(file);
    else excludedFiles.push({file, reason: 'deleted from working tree'});
  }
  if (files.length === 0) throw new Error(`No maintained Markdown files found in ${root}`);
  const result = {
    scope: {
      discovery: 'git tracked and nonignored untracked .md/.markdown files',
      excludedDirectoryComponents: [...excludedDirectories],
      excludedPathPrefixes: ['openspec/changes/'],
      ignoredUntracked: 'Git ignore rules apply; ignored untracked files are not inventoried',
    },
    root, files, excludedFiles, checkedLinks: 0, checkedAnchors: 0,
    skipped: {external: [], templates: [], unsupportedFragments: []}, failures: [],
  };
  const documentCache = new Map();
  const readDocument = (file) => {
    if (!documentCache.has(file)) {
      const text = fs.readFileSync(file, 'utf8');
      const visible = /\.(md|markdown)$/iu.test(file) ? withoutCode(text)
        : text.replace(/<!--[\s\S]*?(?:-->|$)/gu, mask)
          .replace(/(<(script|style)\b[^>]*>)[\s\S]*?(?:<\/\2\s*>|$)/giu, (block, opening) => opening + mask(block.slice(opening.length)));
      documentCache.set(file, visible);
    }
    return documentCache.get(file);
  };
  const anchorCache = new Map();
  const existsCache = new Map();
  for (const file of files) {
    const absoluteFile = path.join(root, file);
    for (const link of linksIn(readDocument(absoluteFile))) {
      const location = {file, ...link};
      if (link.error) { result.failures.push({...location, reason: link.error}); continue; }
      let target = decodeEntities(unescapeMarkdown(link.target));
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/iu.test(target)) { result.skipped.external.push(location); continue; }
      if (/[<>]|\{\{|\$\{/u.test(target)) { result.skipped.templates.push(location); continue; }
      const hash = target.indexOf('#');
      let fragment = hash >= 0 ? target.slice(hash + 1) : '';
      target = (hash >= 0 ? target.slice(0, hash) : target).split('?')[0];
      try {
        target = decodeURIComponent(target);
        fragment = decodeURIComponent(fragment);
      } catch {
        result.failures.push({...location, reason: 'invalid URL encoding'});
        continue;
      }
      if (/[<>]|\{\{|\$\{/u.test(`${target}#${fragment}`)) { result.skipped.templates.push(location); continue; }
      const resolved = !target ? absoluteFile : target.startsWith('/')
        ? path.join(root, target.replace(/^\/+/u, '')) : path.resolve(path.dirname(absoluteFile), target);
      if (path.relative(root, resolved).startsWith(`..${path.sep}`) || path.relative(root, resolved) === '..') {
        result.failures.push({...location, reason: 'target is outside repository'});
        continue;
      }
      result.checkedLinks += 1;
      if (!existsCache.has(resolved)) existsCache.set(resolved, fs.existsSync(resolved));
      if (!existsCache.get(resolved)) { result.failures.push({...location, reason: 'missing target'}); continue; }
      if (!fragment) continue;
      const markdown = /\.(md|markdown)$/iu.test(resolved);
      if (!markdown && !/\.html?$/iu.test(resolved)) { result.skipped.unsupportedFragments.push(location); continue; }
      if (!fs.statSync(resolved).isFile()) { result.failures.push({...location, reason: 'fragment target is not a file'}); continue; }
      if (!anchorCache.has(resolved)) anchorCache.set(resolved, anchorsFor(readDocument(resolved), markdown));
      result.checkedAnchors += 1;
      if (!anchorCache.get(resolved).has(fragment)) result.failures.push({...location, reason: `missing anchor: #${fragment}`});
    }
  }
  return result;
}

let json = false;
try {
  const args = process.argv.slice(2);
  let root = resolveRepoRoot(path.dirname(fileURLToPath(import.meta.url)));
  let showHelp = false;
  let rootSpecified = false;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--json') json = true;
    else if (argument === '--help' || argument === '-h') showHelp = true;
    else if (argument === '--root') {
      if (rootSpecified || !args[index + 1] || args[index + 1].startsWith('-')) throw new Error('--root requires one repository path');
      root = path.resolve(args[++index]);
      rootSpecified = true;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (showHelp) console.log(help);
  else {
    const gitRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {cwd: root, encoding: 'utf8'}).trim();
    if (fs.realpathSync(gitRoot) !== fs.realpathSync(root)) throw new Error('--root must identify the Git repository root');
    const result = check(root);
    if (json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(`[doc-links] ${result.failures.length ? 'FAIL' : 'OK'}: ${result.files.length} markdown files; ${result.checkedLinks} local links; ${result.checkedAnchors} anchors; ${result.failures.length} failure(s)`);
      console.log(`[doc-links] Not validated: ${result.skipped.external.length} external URLs; ${result.skipped.templates.length} templates; ${result.skipped.unsupportedFragments.length} non-Markdown/HTML fragments. Use --json for inventory and locations.`);
      for (const failure of result.failures) console.error(`- ${failure.file}:${failure.line} -> ${failure.target} (${failure.reason})`);
      for (const template of result.skipped.templates) console.log(`- skipped template: ${template.file}:${template.line} -> ${template.target}`);
    }
    if (result.failures.length) process.exitCode = 1;
  }
} catch (error) {
  if (json) console.log(JSON.stringify({error: error.message}));
  else console.error(`[doc-links] ERROR: ${error.message}`);
  process.exitCode = 1;
}
