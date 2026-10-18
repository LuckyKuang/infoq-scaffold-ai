#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checker = path.join(root, 'tools/check_doc_links.mjs');
const evidence = path.join(root, 'tmp/documentation-audit');
fs.mkdirSync(evidence, {recursive: true});
const fixtures = fs.mkdtempSync(path.join(evidence, 'checker-fixtures-'));
let passed = 0;

function fixture(name, files, tracked = []) {
  const directory = path.join(fixtures, name);
  fs.mkdirSync(directory, {recursive: true});
  for (const [file, contents] of Object.entries(files)) {
    const target = path.join(directory, file);
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, contents, 'utf8');
  }
  const init = spawnSync('git', ['init', '--quiet', directory], {encoding: 'utf8'});
  assert.equal(init.status, 0, init.stderr);
  if (tracked.length) {
    const add = spawnSync('git', ['-c', 'core.autocrlf=false', 'add', '--force', '--', ...tracked], {cwd: directory, encoding: 'utf8'});
    assert.equal(add.status, 0, add.stderr);
  }
  return directory;
}

function run(directory, args = ['--json']) {
  const result = spawnSync(process.execPath, [checker, '--root', directory, ...args], {
    cwd: directory, encoding: 'utf8', timeout: 15_000, maxBuffer: 16 * 1024 * 1024,
  });
  assert.ifError(result.error);
  return {...result, ...(args.includes('--json') ? {data: JSON.parse(result.stdout)} : {})};
}

function test(name, callback) {
  callback();
  passed += 1;
  console.log(`[doc-links-test] PASS ${name}`);
}

try {
  test('discovers tracked, new, hidden and .markdown documents with visible exclusions', () => {
    const directory = fixture('discovery', {
      'README.md': '[target](target.txt)\n',
      'target.txt': 'target',
      '.codex/README.md': '[target](../target.txt)\n',
      '.agents/rules.MARKDOWN': '[target](../target.txt)\n',
      '.github/PULL_REQUEST_TEMPLATE.md': '[target](../target.txt)\n',
      'new.markdown': '[target](target.txt)\n',
      'ignored.md': '[bad](missing)\n',
      'tracked-ignored.md': '[target](target.txt)\n',
      'deleted.md': 'deleted',
      'node_modules/dependency.md': '[bad](missing)\n',
      'docs/dist/generated.md': '[bad](missing)\n',
      'tmp/evidence.md': '[bad](missing)\n',
      'openspec/changes/local/proposal.md': '[bad](missing)\n',
      '.gitignore': 'ignored.md\ntracked-ignored.md\n',
    }, ['README.md', 'tracked-ignored.md', 'deleted.md', 'node_modules/dependency.md']);
    fs.unlinkSync(path.join(directory, 'deleted.md'));
    const {status, data} = run(directory);
    assert.equal(status, 0);
    assert.deepEqual(data.files, ['.agents/rules.MARKDOWN', '.codex/README.md', '.github/PULL_REQUEST_TEMPLATE.md', 'README.md', 'new.markdown', 'tracked-ignored.md']);
    assert.equal(data.checkedLinks, 6);
    assert.match(data.scope.discovery, /nonignored untracked/u);
    assert(data.scope.excludedDirectoryComponents.includes('node_modules'));
    assert.deepEqual(data.scope.excludedPathPrefixes, ['openspec/changes/']);
    assert.deepEqual(data.failures, []);
    assert.deepEqual(data.excludedFiles.map(({file}) => file), ['deleted.md', 'docs/dist/generated.md', 'node_modules/dependency.md', 'openspec/changes/local/proposal.md', 'tmp/evidence.md']);
    assert.match(data.excludedFiles.find(({file}) => file === 'deleted.md').reason, /deleted/u);
    assert.match(data.excludedFiles.find(({file}) => file === 'docs/dist/generated.md').reason, /dist/u);
    assert.match(data.excludedFiles.find(({file}) => file.startsWith('openspec/')).reason, /OpenSpec/u);
  });

  test('checks inline, image, reference, escaped, angle, encoded and nested paths', () => {
    const directory = fixture('syntax', {
      'README.md': String.raw`[inline](target.md "a title")
![image](image.svg)
[angle](<space dir/a (b).md>)
[escaped](space\ dir/a\ \(b\).md)
[encoded](/space%20dir/a%20%28b%29.md)
[balanced](nested(a(b)).md)
[full][TARGET]
[collapsed][]
[shortcut]
![reference image][target]
[![nested image](image.svg)](target.md)
[one\]two][escaped\]label]
[multi word][label with
 spaces]

[target]: target.md 'reference title'
[collapsed]: <space dir/a (b).md>
[shortcut]: target.md
[escaped\]label]: target.md
[label with spaces]: target.md
`,
      'target.md': '# Target\n',
      'image.svg': '<svg/>',
      'space dir/a (b).md': '# Target\n',
      'nested(a(b)).md': '# Target\n',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedLinks, 14);
    assert.deepEqual(data.failures, []);
  });

  test('checks Markdown headings, duplicate collisions, Unicode and explicit HTML anchors', () => {
    const directory = fixture('anchors', {
      'README.md': '[ATX](target.md#hello-world)\n[Setext](target.md#setext)\n[duplicate](target.md#hello-world-2)\n[collision](target.md#hello-world-1-1)\n[unicode](target.md#%E4%B8%AD%E6%96%87-%E6%A0%87%E9%A2%98)\n[format](target.md#bold-code_name--text)\n[inline](target.md#inline-heading)\n[id](target.md#CaseSensitive)\n[name](target.md#legacy)\n[html](target.html#section)\n[underscores](target.md#bold-emphasis)\n[html code element](target.html#example)\n',
      'target.md': '# Hello World\n# Hello World\n# Hello World\n# Hello World-1\nSetext\n---\n# 中文 标题\n# **Bold** `code_name` &amp; text\n# [Inline](target.html) heading\n<a id="CaseSensitive"></a>\n<a name="legacy"></a>\n# __Bold__ _emphasis_\n',
      'target.html': '<html>\n  <body>\n    <div id="section">Section</div>\n    <pre id="example">const value = 1;</pre>\n  </body>\n</html>',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedAnchors, 12);
  });

  test('checks HTML href/src and entities without parsing Markdown inside attributes', () => {
    const directory = fixture('html', {
      'README.md': '<a href="target.md#id&amp;name" title="[text](missing)">text</a>\n<img src=\'space%20dir/image.svg\'>\n<a href="a&#32;b.txt">entity</a>\n',
      'target.md': '<span id="id&amp;name"></span>\n',
      'space dir/image.svg': '<svg/>',
      'a b.txt': 'target',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedLinks, 3);
    assert.equal(data.checkedAnchors, 1);
  });

  test('heading anchor text ignores complete tags with quoted delimiters, not literal or malformed text', () => {
    const directory = fixture('heading-tags', {
      'README.md': '[quoted](target.md#hello)\n[mixed](target.md#hello-world)\n[comment](target.md#after-comment)\n[literal](target.md#1--2)\n[malformed](malformed.md#broken-titleunterminatedhello)\n[multiline](target.md#heading)\n[code](target.md#bcodeb)\n[escaped](target.md#btextb)\n',
      'target.md': '# <span title="a>b">Hello</span>\n# <i title=\'x>y\'>Hello</i> <b>World</b>\n<!-- hidden > markup -->\n# After comment\n# 1 < 2\n<span\n title="line > delimiter"\n id="heading">text</span>\n# `<b>Code</b>`\n# \\<b>Text\\</b>\n',
      'malformed.md': '# <broken title="unterminated>Hello\n',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedAnchors, 8);
  });

  test('ignores code fences, spans, escaped brackets, comments, pre and code blocks', () => {
    const directory = fixture('code', {
      'README.md': [
        '````md', '[bad](missing-fence)', '```', '[bad](still-in-fence)', '````',
        '~~~', '[bad](missing-tilde)', '~~~~',
        '> ```md', '> [bad](missing-quote)', '> ```',
        '    [bad](missing-indent)', '\t[bad](missing-tab)',
        '`[bad](missing-span)` and ``[bad](missing-double) ` other``',
        '`code \\` [good](target.md)',
        '\\` [escaped tick](target.md) \\`',
        '\\[bad](escaped-bracket)',
        '<!-- [bad](missing-comment) -->',
        '<pre>[bad](missing-pre)</pre>', '<code>[bad](missing-code)</code>',
        '[good](target.md)',
      ].join('\n'),
      'target.md': '# Target\n',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedLinks, 3);
  });

  test('external URLs are recorded without network access and skips remain observable', () => {
    const directory = fixture('skips', {
      'README.md': '[external](https://127.0.0.1:1/unreachable)\n[mail](mailto:test@example.invalid)\n[phone](tel:123)\n[data](data:image/png;base64,AA)\n[protocol relative](//127.0.0.1:1/unreachable)\n[template](docs/<change-id>/spec.md)\n[encoded template](docs/%3Cchange-id%3E/spec.md)\n[variable](${target}/spec.md)\n[mustache]({{target}}/spec.md)\n[code fragment](target.mjs#L1)\n[empty]()\n',
      'target.mjs': 'export {};\n',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.skipped.external.length, 5);
    assert.equal(data.skipped.templates.length, 4);
    assert.equal(data.skipped.unsupportedFragments.length, 1);
    assert.equal(data.checkedLinks, 2);
    const output = run(directory, []);
    assert.equal(output.status, 0);
    assert.match(output.stdout, /5 external URLs; 4 templates; 1 non-Markdown\/HTML fragments/u);
    assert.match(output.stdout, /skipped template: README.md:6/u);
  });

  test('literal fences in comments and literal comments in code cannot hide following links', () => {
    const directory = fixture('code-context', {
      'README.md': [
        '<!--', '```', '[bad](comment)', '-->', '[visible](target.md)',
        '```md', '<!--', '[bad](fence)', '```', '[visible](target.md)',
        '`<!--` [visible](target.md)',
        '<pre>``` [bad](pre)</pre> [visible](target.md)',
        '<code>``` [bad](code)</code> [visible](target.md)',
        '😀 `literal` [visible](target.md)',
      ].join('\n'),
      'target.md': '# Target\n',
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedLinks, 6);
  });

  test('reports missing paths, anchors, encoding, outside paths and reference definitions with exact lines', () => {
    const directory = fixture('failures', {
      'README.md': '# Test\r\n[missing](missing.md)\r\n![missing image](missing.svg)\r\n[anchor](target.md#absent)\r\n[bad encoding](%ZZ.md)\r\n[outside](../outside.md)\r\n[undefined][not-defined]\r\n[collapsed][]\r\n[undefined shortcut]\r\n',
      'target.md': '# Target\n',
    });
    const {status, data} = run(directory);
    assert.equal(status, 1);
    assert.deepEqual(data.failures.map(({file, line, reason}) => ({file, line, reason})), [
      {file: 'README.md', line: 2, reason: 'missing target'},
      {file: 'README.md', line: 3, reason: 'missing target'},
      {file: 'README.md', line: 4, reason: 'missing anchor: #absent'},
      {file: 'README.md', line: 5, reason: 'invalid URL encoding'},
      {file: 'README.md', line: 6, reason: 'target is outside repository'},
      {file: 'README.md', line: 7, reason: 'undefined reference'},
      {file: 'README.md', line: 8, reason: 'undefined reference'},
    ]);
    const output = run(directory, []);
    assert.equal(output.status, 1);
    assert.match(output.stderr, /README\.md:2 -> missing\.md \(missing target\)/u);
    assert.match(output.stderr, /README\.md:4 -> target\.md#absent/u);
  });

  test('new hidden documents cannot conceal a broken link', () => {
    const directory = fixture('hidden-failure', {'README.md': '# Good\n', '.codex/new.markdown': '\n[bad](missing.md)\n'}, ['README.md']);
    const {status, data} = run(directory);
    assert.equal(status, 1);
    assert.deepEqual(data.failures, [{file: '.codex/new.markdown', line: 2, target: 'missing.md', reason: 'missing target'}]);
  });

  test('HTML paths and absent code-only anchors fail with source locations', () => {
    const directory = fixture('html-failures', {
      'README.md': '<img src="missing.svg">\n<a href="target.md#fake">fake</a>\n[comment](target.md#comment)\n[case](target.html#casesensitive)\n[html comment](target.html#comment)\n[script](target.html#script)\n',
      'target.md': '```md\n# Fake\n```\n<!-- <span id="comment"></span> -->\n',
      'target.html': '<div id="CaseSensitive"></div><!-- <div id="comment"></div> --><script>const html = \'<div id="script"></div>\';</script>',
    });
    const {status, data} = run(directory);
    assert.equal(status, 1);
    assert.deepEqual(data.failures.map(({file, line, target, reason}) => ({file, line, target, reason})).sort((a, b) => a.line - b.line), [
      {file: 'README.md', line: 1, target: 'missing.svg', reason: 'missing target'},
      {file: 'README.md', line: 2, target: 'target.md#fake', reason: 'missing anchor: #fake'},
      {file: 'README.md', line: 3, target: 'target.md#comment', reason: 'missing anchor: #comment'},
      {file: 'README.md', line: 4, target: 'target.html#casesensitive', reason: 'missing anchor: #casesensitive'},
      {file: 'README.md', line: 5, target: 'target.html#comment', reason: 'missing anchor: #comment'},
      {file: 'README.md', line: 6, target: 'target.html#script', reason: 'missing anchor: #script'},
    ]);
  });

  test('paragraph breaks do not turn adjacent ordinary bracket text into explicit references', () => {
    const directory = fixture('paragraphs', {'README.md': '[ordinary]\n\n[other ordinary]\n\n[defined]\n\n[defined]: README.md\n'});
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedLinks, 1);
  });

  test('unknown and missing options fail before checking documents', () => {
    const directory = fixture('arguments', {'README.md': '# Good\n'});
    for (const args of [['--json', '--unknown'], ['--json', '--root'], ['--json', '--root', '--help'], ['--json', '--root', '-h'], ['--json', '--root', directory]]) {
      const {status, data} = run(directory, args);
      assert.equal(status, 1, JSON.stringify(args));
      assert.match(data.error, /Unknown argument|--root requires one repository path/u);
    }
    const help = run(directory, ['--help']);
    assert.equal(help.status, 0);
    assert.match(help.stdout, /not a complete CommonMark renderer/u);
    const nested = path.join(directory, 'nested');
    fs.mkdirSync(nested);
    const invalidRoot = run(nested);
    assert.equal(invalidRoot.status, 1);
    assert.match(invalidRoot.data.error, /Git repository root/u);
    const empty = run(fixture('empty', {'file.txt': 'text'}));
    assert.equal(empty.status, 1);
    assert.match(empty.data.error, /No maintained Markdown files/u);
  });

  test('large unclosed bracket input and repeated headings terminate within the CLI timeout', () => {
    const directory = fixture('large', {
      'README.md': `${'['.repeat(100_000)}\n[anchor](target.md#repeat-9999)\n`,
      'target.md': '# Repeat\n'.repeat(10_000),
    });
    const {status, data} = run(directory);
    assert.equal(status, 0, JSON.stringify(data));
    assert.equal(data.checkedAnchors, 1);
  });

  console.log(`[doc-links-test] OK: ${passed} isolated Git fixture scenarios; no network requests.`);
} catch (error) {
  console.error(`[doc-links-test] FAIL after ${passed} scenarios: ${error.stack}`);
  process.exitCode = 1;
} finally {
  fs.rmSync(fixtures, {recursive: true, force: true});
}
