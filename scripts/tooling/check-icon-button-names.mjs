#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// check-icon-button-names.mjs — a button that shows no text must say what it is
//
// WHY THIS REPLACED A TEST. tests/unit/icon-buttons-are-named.test.ts shipped in
// T-0050 with this matcher:
//
//   /<button\b([^>]*)>\s*<[A-Z][\w]*\s[^>]*\/>\s*<\/button>/
//
// It matched 3 of 394 buttons. Four independent reasons, each fatal on its own:
// no `i` flag, so `<Button>` (the shared component, and the dominant form) never
// matched; applied per line, so multi-line JSX was invisible; the icon had to be
// the SOLE child, so any trailing expression failed it; and `[^>]*` cannot cross
// a `>`, so any `onClick={() => fn()}` ended the attribute capture early and
// killed the match. It found one already-compliant button on day one, which is
// perfect camouflage for a guard that sees 0.76% of its subject, and 26 unnamed
// buttons shipped underneath it, including a destructive Delete and three that
// are the only exit from their UI.
//
// WHY A PARSER. The rule turns on whether a subtree renders text
// UNCONDITIONALLY, and that is a tree question. A brace-aware string scanner was
// measured at 79 flagged with roughly 53 false positives, because
// `<span>{prev ? prev.title : "Next"}</span>` and `{armed ? " Confirm?" : ""}`
// are two characters apart in shape and opposite in verdict. The TypeScript
// parser answers it exactly: 27 flagged, no false positives, no false negatives
// against a hand-verified list.
//
// ON WG-WEB-013. The rule is that a gate must not require an install step. It
// does not forbid using a devDependency the lint chain already executes twice,
// once as eslint's parser and once as `npm run typecheck:tests`. Ruled by the
// operator on 2026-08-30. The import list is asserted by the companion test, so
// the exception is visible rather than inherited.
//
// THE DENOMINATOR, which is the part T-0050 got wrong. Its test DID assert one:
// `files.length > 100`. It was inert anyway, because the denominator was on the
// wrong noun. The rule is about buttons; it counted files. So this gate counts
// and PRINTS three numbers, and refuses to pass if any collapses. The one that
// matters is iconOnlySeen: files-walked and buttons-found only prove the walk
// ran, while icon-only-classified proves the classifier still classifies. Break
// `rendersText` so every button reads as text-bearing and the offender list
// empties while the first two floors stay green. Only the third goes red.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname, sep } from "path";
import { fileURLToPath } from "url";

import ts from "typescript";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** Named by any of these, and the rule is satisfied. */
const NAME_ATTRS = new Set(["aria-label", "aria-labelledby", "title"]);

const PRAGMA = "icon-button-names-disable-next-line";
const MIN_REASON_LENGTH = 12;

/**
 * Does this JSX child render text no matter which way its conditionals fall?
 *
 * Optimism on `{label}` is deliberate and the asymmetry is the point: a missed
 * offender is a gap, a false alarm is a gate people delete.
 */
function rendersText(node) {
  if (ts.isJsxText(node)) return node.text.trim().length > 0;
  if (ts.isJsxElement(node)) return node.children.some(rendersText);
  if (ts.isJsxFragment(node)) return node.children.some(rendersText);
  if (ts.isJsxSelfClosingElement(node)) return false;
  if (ts.isJsxExpression(node)) return node.expression ? rendersText(node.expression) : false;

  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text.trim().length > 0;
  }
  if (node.kind === ts.SyntaxKind.NullKeyword) return false;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (ts.isIdentifier(node) && node.text === "undefined") return false;

  // Both branches must render, or the name disappears in one state. This is the
  // row that catches `{armed ? " Confirm?" : ""}`, the destructive Delete.
  if (ts.isConditionalExpression(node)) {
    return rendersText(node.whenTrue) && rendersText(node.whenFalse);
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    // `a && b` renders nothing when a is falsy.
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return false;
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return rendersText(node.left) && rendersText(node.right);
    }
  }
  if (ts.isParenthesizedExpression(node)) return rendersText(node.expression);

  // Identifiers, member access, calls, templates, numbers: assume they render.
  return true;
}

function attrsOf(opening) {
  const names = new Set();
  for (const a of opening.attributes.properties) {
    if (ts.isJsxAttribute(a) && a.name) names.add(a.name.getText());
  }
  return names;
}

function tagNameOf(opening) {
  return opening.tagName.getText();
}

function isButtonTag(name) {
  return name === "button" || name === "Button";
}

/**
 * A link is named by the same rule as a button. The collapsed sidebar
 * rendered thirty <Link>s as a bare icon, and this gate saw none of them
 * because it looked at buttons alone; a screen reader announced "link"
 * thirty times with no destination (T-0096, D119). The nesting check below
 * stays button-only: an <a> around a <button> is the sessions rows' defect
 * (D32) and it is fixed in its own batch, not by a gate going red here.
 */
function isLinkTag(name) {
  return name === "Link" || name === "a";
}

/**
 * Classify one file. Exported so the companion test can drive it with fixtures
 * rather than only over the tree: floors catch "the walk found nothing", and
 * fixtures catch "the matcher stopped matching".
 */
export function classifyButtons(sourceText, fileName = "x.tsx") {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = sourceText.split(/\r?\n/);
  const out = { buttons: 0, links: 0, iconOnly: 0, unnamed: [], nested: [] };

  const exempt = (line1) => {
    const prev = lines[line1 - 2] ?? "";
    if (!prev.includes(PRAGMA)) return false;
    const reason = prev.split("--").slice(1).join("--").trim();
    return reason.length >= MIN_REASON_LENGTH;
  };

  // `insideButton` is the whole nested check: a button reached while already
  // inside one is invalid HTML. Browsers recover by HOISTING the inner control
  // out of the outer button, so the rendered tree stops matching the source and
  // the inner control's click, focus order and accessible name all move
  // somewhere the author did not put them (T-0071).
  const visit = (node, insideButton) => {
    let opening = null;
    let children = null;
    if (ts.isJsxElement(node)) {
      opening = node.openingElement;
      children = node.children;
    } else if (ts.isJsxSelfClosingElement(node)) {
      opening = node;
      children = [];
    }

    const isButton = opening && isButtonTag(tagNameOf(opening));
    const isLink = opening && isLinkTag(tagNameOf(opening));
    if (isButton || isLink) {
      if (isButton) out.buttons += 1;
      else out.links += 1;
      const line = sf.getLineAndCharacterOfPosition(opening.getStart(sf)).line + 1;
      if (isButton && insideButton) out.nested.push({ line, tag: tagNameOf(opening) });
      if (!children.some(rendersText)) {
        out.iconOnly += 1;
        const named = [...attrsOf(opening)].some((a) => NAME_ATTRS.has(a));
        if (!named && !exempt(line)) {
          out.unnamed.push({ line, tag: tagNameOf(opening) });
        }
      }
    }
    ts.forEachChild(node, (child) => visit(child, insideButton || isButton));
  };
  visit(sf, false);
  return out;
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (extname(p) === ".tsx") acc.push(p);
  }
  return acc;
}

export function scanTree() {
  const files = walk(SRC);
  let buttonsSeen = 0;
  let linksSeen = 0;
  let iconOnlySeen = 0;
  let filesWithButtons = 0;
  const offenders = [];
  const nested = [];

  for (const file of files) {
    const r = classifyButtons(readFileSync(file, "utf-8"), file);
    buttonsSeen += r.buttons;
    linksSeen += r.links;
    iconOnlySeen += r.iconOnly;
    if (r.buttons > 0) filesWithButtons += 1;
    const rel = file.slice(ROOT.length + 1).split(sep).join("/");
    for (const u of r.unnamed) offenders.push(`${rel}:${u.line} <${u.tag}>`);
    for (const n of r.nested) nested.push(`${rel}:${n.line} <${n.tag}>`);
  }
  return { filesScanned: files.length, filesWithButtons, buttonsSeen, linksSeen, iconOnlySeen, offenders, nested };
}

export function formatSummary(c) {
  return (
    `icon-button names: ${c.iconOnlySeen} icon-only buttons and links, ${c.offenders.length} unnamed, ` +
    `${c.nested.length} nested ` +
    `(${c.linksSeen ?? 0} link elements, ${c.buttonsSeen} button elements across ${c.filesWithButtons} of ${c.filesScanned} .tsx files).`
  );
}

/**
 * Turn a scan into an exit code and the text to print.
 *
 * Extracted from `main()` so the DECISION can be tested without spawning a
 * process or writing a fixture into src/. Mutation found the hole this closes:
 * deleting the nested branch's `process.exit(1)` left every assertion green,
 * because every test drove the CLASSIFIER and none drove the verdict. A gate
 * that reports and does not fail the build is decoration (T-0071).
 */
export function verdict(counts) {
  // Guard the guard. Floors chosen against a measured 227 files / 394 buttons /
  // 77 icon-only, low enough to survive ordinary churn and high enough that a
  // walk which stopped finding things cannot read as a pass.
  if (counts.filesScanned < 150 || counts.buttonsSeen < 250 || counts.iconOnlySeen < 40) {
    return {
      code: 1,
      message:
        `icon-button names: refusing to pass on a population this small.\n` +
        `  files ${counts.filesScanned} (floor 150), buttons ${counts.buttonsSeen} (floor 250), ` +
        `icon-only ${counts.iconOnlySeen} (floor 40).\n` +
        `Either the tree moved or the classifier stopped classifying. A guard that\n` +
        `inspects nothing passes everything, which is how the check this replaced\n` +
        `shipped 26 unnamed buttons while green.`,
    };
  }

  if (counts.nested.length > 0) {
    return {
      code: 1,
      message:
        `icon-button names: ${counts.nested.length} button(s) inside another button.\n\n` +
        `Nested interactive content is invalid HTML. The browser recovers by hoisting\n` +
        `the inner control OUT of the outer button, so the rendered tree stops matching\n` +
        `the source: the click target, the focus order and the accessible name all move\n` +
        `somewhere you did not put them. Keyboard and screen-reader users lose the\n` +
        `control entirely.\n\n` +
        `Make the outer element a container and put the actions BESIDE the label\n` +
        `rather than inside it. See src/app/orchestration/chat/page.tsx (T-0071).\n\n` +
        counts.nested.map((n) => `  ${n}`).join("\n"),
    };
  }

  if (counts.offenders.length > 0) {
    return {
      code: 1,
      message:
        `icon-button names: ${counts.offenders.length} button(s) with no accessible name.\n\n` +
        counts.offenders.map((o) => `  ${o}`).join("\n") +
        `\n\nA button whose children render no text needs aria-label (preferred),` +
        `\naria-labelledby, or title. A name that exists in only one state is not a name:` +
        `\n{armed ? " Confirm?" : ""} reads as unnamed, deliberately.` +
        `\n\nIf a button genuinely needs no name, exempt the line above it with:` +
        `\n  // ${PRAGMA} -- <reason, at least ${MIN_REASON_LENGTH} chars>`,
    };
  }

  return { code: 0, message: formatSummary(counts) };
}

function main() {
  const { code, message } = verdict(scanTree());
  if (code !== 0) {
    console.error(message);
    process.exit(code);
  }

  console.log(message);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
