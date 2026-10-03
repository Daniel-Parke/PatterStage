// Current-tree mechanical inventory with independent primary-behaviour labels.
// Run from repository root: node org/reviews/2026-09-t0164-classify.mjs
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(e => e.isDirectory()
      ? walk(path.join(dir, e.name))
      : [path.join(dir, e.name)]);
}
const slash = file => file.replace(/\\/g, '/');
const catches = [];
for (const file of walk('src').filter(f => /\.tsx?$/.test(f)).sort()) {
  const ast = ts.createSourceFile(
    file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isCatchClause(node) && !node.variableDeclaration) {
      catches.push({
        id: catches.length,
        location: `${slash(file)}:${ast.getLineAndCharacterOfPosition(
          node.getStart(ast)).line + 1}`
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
const suites = [];
for (const file of walk('tests/unit')
  .filter(f => /\.test\.tsx?$/.test(f)).sort()) {
  const ast = ts.createSourceFile(
    file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let read = false, src = false;
  function visit(node) {
    if (ts.isCallExpression(node) &&
        /\breadFileSync$/.test(node.expression.getText(ast))) read = true;
    if (ts.isStringLiteralLike(node) &&
        /(^src$|^src[\\\/]|[\\\/]src[\\\/])/.test(node.text)) src = true;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (read && src) suites.push({ id: suites.length, file: slash(file) });
}

const categories = {
  "catch_categories": {
    "schema": [
      66,
      67,
      68,
      69,
      70,
      73,
      74,
      75,
      76,
      77,
      78,
      79,
      80,
      81,
      82,
      83,
      84,
      85,
      86,
      87,
      90,
      91,
      94,
      95,
      96,
      97,
      126,
      176
    ],
    "parse": [
      2,
      16,
      23,
      31,
      32,
      33,
      38,
      53,
      54,
      55,
      56,
      58,
      60,
      61,
      62,
      71,
      72,
      93,
      106,
      120,
      121,
      122,
      131,
      139,
      141,
      147,
      151,
      155,
      158,
      159,
      185,
      186,
      187,
      191,
      209,
      220,
      231,
      232,
      239,
      241,
      242,
      243,
      248,
      250
    ],
    "lifecycle": [
      12,
      13,
      14,
      15,
      39,
      92,
      110,
      113,
      114,
      132,
      136,
      145,
      146,
      182,
      183,
      226
    ],
    "skip": [
      6,
      49,
      50,
      88,
      127,
      128,
      142,
      180,
      208,
      211,
      213,
      229,
      235,
      251
    ],
    "bestEffort": [
      18,
      35,
      37,
      40,
      41,
      42,
      43,
      51,
      64,
      65,
      98,
      100,
      103,
      129,
      135,
      148,
      153,
      154,
      172,
      173,
      174,
      175,
      177,
      178,
      204,
      205,
      206,
      217,
      222,
      236,
      240
    ],
    "surfaced": [
      0,
      1,
      3,
      4,
      5,
      10,
      24,
      28,
      57,
      112,
      149,
      215,
      219,
      252
    ],
    "silentForeground": [
      9,
      19,
      21,
      22,
      26,
      27,
      29,
      164,
      244,
      246
    ],
    "strict": [
      161,
      162,
      163,
      233,
      234
    ],
    "fallback": [
      7,
      8,
      11,
      17,
      20,
      25,
      30,
      34,
      36,
      44,
      45,
      46,
      47,
      48,
      52,
      59,
      63,
      89,
      99,
      101,
      102,
      104,
      105,
      107,
      108,
      109,
      111,
      115,
      116,
      117,
      118,
      119,
      123,
      124,
      125,
      130,
      133,
      134,
      137,
      138,
      140,
      143,
      144,
      150,
      152,
      156,
      157,
      160,
      165,
      166,
      167,
      168,
      169,
      170,
      171,
      179,
      181,
      184,
      188,
      189,
      190,
      192,
      193,
      194,
      195,
      196,
      197,
      198,
      199,
      200,
      201,
      202,
      203,
      207,
      210,
      212,
      214,
      216,
      218,
      221,
      223,
      224,
      225,
      227,
      228,
      230,
      237,
      238,
      245,
      247,
      249
    ]
  },
  "suite_categories": {
    "liveSrcAssertion": [
      2,
      3,
      4,
      5,
      6,
      7,
      9,
      10,
      11,
      12,
      13,
      14,
      15,
      16,
      18,
      19,
      20,
      21,
      22,
      23,
      24,
      25,
      26,
      27,
      28,
      30,
      31,
      32,
      33,
      34,
      36,
      38,
      39,
      40,
      41,
      42,
      43,
      44,
      47,
      48,
      49,
      50,
      56,
      57,
      58,
      59,
      61,
      62,
      63,
      64,
      65,
      66,
      67,
      68,
      70,
      71,
      72,
      73,
      75,
      76,
      77,
      78,
      81,
      85,
      86,
      87,
      89,
      90,
      91,
      92,
      93,
      94,
      95,
      96,
      97,
      98,
      100,
      101,
      102,
      103,
      104,
      105,
      106,
      107,
      108,
      109,
      110,
      111,
      112,
      113,
      114,
      115,
      116,
      117,
      118,
      119,
      120,
      121,
      122,
      123,
      124,
      125
    ],
    "otherStaticContract": [
      1,
      17,
      37,
      60,
      74,
      83,
      88
    ],
    "fixtureOrExecutionRead": [
      0,
      8,
      29,
      35,
      45,
      46,
      51,
      52,
      53,
      54,
      55,
      69,
      79,
      80,
      82,
      84,
      99
    ]
  }
};
// Independent sceptic correction at current source: the first-pass primary
// categories overread these sites. Keep the original mapping visible for audit.
const corrections = {
  catch: { 9: 'bestEffort', 90: 'skip', 91: 'skip', 95: 'fallback', 96: 'skip', 97: 'skip',
    159: 'surfaced', 164: 'fallback', 244: 'bestEffort', 246: 'fallback' },
  suite: { 77: 'otherStaticContract' },
};
function labels(groups, count, amendments) {
  const byId = Array(count).fill(null);
  for (const [name, ids] of Object.entries(groups)) {
    for (const id of ids) {
      if (id < 0 || id >= count || byId[id]) throw new Error(`Duplicate or out-of-range classification: ${id}`);
      byId[id] = name;
    }
  }
  if (byId.some((label) => label === null)) throw new Error('Unclassified scanner ID');
  for (const [id, category] of Object.entries(amendments)) {
    if (!Object.hasOwn(groups, category)) throw new Error(`Unknown corrected category: ${category}`);
    byId[Number(id)] = category;
  }
  return byId;
}
const catchLabels = labels(categories.catch_categories, catches.length, corrections.catch);
const suiteLabels = labels(categories.suite_categories, suites.length, corrections.suite);
console.log(JSON.stringify({
  method: 'TypeScript AST catch clauses without bindings; suite screen is readFileSync plus a src literal anywhere in one test AST. Labels are semantic inspection, not a claim of defect or exhaustive source-text detection.',
  catchCount: catches.length,
  candidateSuiteCount: suites.length,
  catches: catches.map((item, id) => ({ ...item, category: catchLabels[id] })),
  suites: suites.map((item, id) => ({ ...item, category: suiteLabels[id] })),
}, null, 2));
