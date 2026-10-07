import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

export function measureComments(source, filePath) {
  const text = source.replace(/\r\n?/g, '\n');
  const physicalLines = text === '' ? 0 : text.split('\n').length - Number(text.endsWith('\n'));
  const tree = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true,
    /\.tsx$/i.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const protectedRanges = [];
  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isRegularExpressionLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      protectedRanges.push([ts.isJsxText(node) ? node.pos : node.getStart(tree), node.end]);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  protectedRanges.sort((a, b) => a[0] - b[0]);
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
  const commentLines = new Set();
  let range = 0;
  while (scanner.getTextPos() < text.length) {
    const position = scanner.getTextPos();
    while (range < protectedRanges.length && protectedRanges[range][1] <= position) range++;
    if (range < protectedRanges.length && protectedRanges[range][0] <= position) {
      scanner.setTextPos(protectedRanges[range][1]);
      continue;
    }
    const kind = scanner.scan();
    if (kind === ts.SyntaxKind.SingleLineCommentTrivia || kind === ts.SyntaxKind.MultiLineCommentTrivia) {
      const first = tree.getLineAndCharacterOfPosition(scanner.getTokenPos()).line;
      const last = tree.getLineAndCharacterOfPosition(scanner.getTextPos() - 1).line;
      for (let line = first; line <= last; line++) commentLines.add(line);
    }
  }
  return { physicalLines, commentLines: commentLines.size,
    essay: physicalLines >= 60 && commentLines.size / physicalLines >= 0.4 };
}

function parseArguments(args) {
  const options = { root: process.cwd(), baseline: 'tests/fixtures/test-comment-census.baseline.json', json: false, capture: false };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!['--root', '--baseline', '--json', '--capture', '--reason'].includes(key) || seen.has(key)) {
      throw new Error(`Unknown or repeated selector: ${key}`);
    }
    seen.add(key);
    if (key === '--json' || key === '--capture') options[key.slice(2)] = true;
    else {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Missing value: ${key}`);
      options[key.slice(2)] = value;
    }
  }
  if (options.capture && !options.reason?.trim()) throw new Error('Capture requires a written reason');
  if (!options.capture && options.reason !== undefined) throw new Error('A reason requires capture');
  return options;
}

function run(args) {
  const options = parseArguments(args);
  const root = resolve(options.root);
  const baselinePath = resolve(root, options.baseline);
  const baseline = relative(root, baselinePath).replace(/\\/g, '/');
  if (!baseline || baseline.startsWith('../') || baseline.startsWith('/') || /^[A-Za-z]:/.test(baseline)) {
    throw new Error('Baseline must be inside the checkout');
  }
  const git = (...commands) => execFileSync('git', commands, { cwd: root, encoding: 'utf8', windowsHide: true,
    maxBuffer: 16 * 1024 * 1024, timeout: 30_000 });
  const checkout = resolve(git('rev-parse', '--show-toplevel').trim());
  if (checkout.toLowerCase() !== root.toLowerCase()) throw new Error('Root must be the checkout root');
  const candidates = [...new Set(git('ls-files', '-c', '-o', '--exclude-standard', '-z', '--', 'tests').split('\0'))]
    .filter(path => /^tests\/.+\.tsx?$/i.test(path)).sort();
  if (candidates.length === 0) throw new Error('No tests TS/TSX files in selection');
  const files = candidates.map(path => ({ path, ...measureComments(readFileSync(resolve(root, path), 'utf8'), path) }));
  if (options.capture) {
    if (git('ls-tree', '--name-only', 'HEAD', '--', baseline).trim()) {
      throw new Error('Initial baseline already exists in committed history');
    }
    const data = { version: 1, reason: options.reason.trim(), essays: files.filter(row => row.essay)
      .map(({ path, physicalLines, commentLines }) => ({ path, physicalLines, commentLines })) };
    mkdirSync(dirname(baselinePath), { recursive: true });
    writeFileSync(baselinePath, JSON.stringify(data, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ files, violations: [], baselineSource: 'captured' }));
    return 0;
  }
  const saved = JSON.parse(git('show', `HEAD:${baseline}`));
  if (saved.version !== 1 || typeof saved.reason !== 'string' || !saved.reason.trim() || !Array.isArray(saved.essays)) {
    throw new Error('Invalid committed comment baseline');
  }
  const known = new Map();
  for (const row of saved.essays) {
    if (typeof row.path !== 'string' || known.has(row.path) || !Number.isSafeInteger(row.physicalLines) ||
        !Number.isSafeInteger(row.commentLines) || row.physicalLines < 60 || row.commentLines < 0 ||
        row.commentLines > row.physicalLines || row.commentLines / row.physicalLines < 0.4) {
      throw new Error('Invalid committed essay row');
    }
    known.set(row.path, row);
  }
  const violations = [];
  for (const row of files) {
    const old = known.get(row.path);
    if (!old && row.essay) violations.push({ path: row.path, reason: 'new' });
    else if (old && (row.physicalLines > old.physicalLines || row.commentLines > old.commentLines)) {
      violations.push({ path: row.path, reason: 'growth' });
    }
  }
  const report = { files, violations, baselineSource: 'HEAD' };
  console.log(options.json ? JSON.stringify(report) : JSON.stringify(report, null, 2));
  return violations.length ? 1 : 0;
}

if (import.meta.main) {
  try { process.exitCode = run(process.argv.slice(2)); }
  catch (error) { console.error(`Comment census infrastructure failure: ${error.message}`); process.exitCode = 2; }
}
