#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// check-form-control-names.mjs — a field must say what it is for
//
// WHY IT EXISTS. A browser pass over this product found EIGHT unlabelled form
// controls across four pages: five placeholder-only, and two bare `<select>`s
// with no accessible name at all. Story Weaver's create form was 4 for 4. The
// repo already gates icon-BUTTON names and had no sibling for the controls
// people actually type into, so nothing was watching.
//
// A PLACEHOLDER IS NOT A NAME, and that is the single most important line here.
// It disappears the moment the field has content, so a screen-reader user
// reviewing what they typed hears nothing, and anyone returning to a
// half-filled form has lost the label exactly when they need it. The QA prompt
// this product is tested against names placeholder-as-label explicitly. A gate
// that accepted it would bless five of the eight offenders on day one.
//
// WHY A PARSER, and not a regex. The naming can arrive four ways and two of
// them are structural: an `id` matched by a `<label htmlFor>` somewhere else in
// the file, or being wrapped in a `<label>` that renders text. Neither is
// visible to a line-oriented matcher. This is the lesson T-0050 paid for and
// check-icon-button-names.mjs records: a matcher that sees a fraction of its
// subject is worse than none, because it looks green.
//
// ON WG-WEB-013 (a gate must not require an install step). Same ruling as the
// icon-button gate: the TypeScript compiler is a devDependency the lint chain
// already executes twice, once as eslint's parser and once as typecheck:tests.
//
// THE DENOMINATOR. Two floors, both on the noun the rule is about, and both
// printed on every run. `controlsSeen` collapsing means the walk or the tag
// matcher stopped finding fields, at which point an empty offender list means
// nothing at all. The other half of guard-the-guard is the companion test,
// which drives the classifier with fixtures in BOTH directions — floors catch
// "found nothing", fixtures catch "stopped classifying", and neither catches
// the other.
// ═══════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, statSync } from "fs";
import { join, extname, sep } from "path";
import { fileURLToPath } from "url";

import ts from "typescript";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/** The raw DOM controls a person types into or chooses from. */
const CONTROL_TAGS = new Set(["input", "textarea", "select"]);

/**
 * Attributes that ARE an accessible name.
 *
 * `placeholder` is deliberately absent. `title` is present but grudgingly: it
 * is a real accessible name and a poor one, and it is already accepted by the
 * icon-button gate, so refusing it here would make two gates disagree about
 * what a name is.
 */
const NAME_ATTRS = new Set(["aria-label", "aria-labelledby", "title"]);

const PRAGMA = "form-control-names-disable-next-line";
const MIN_REASON_LENGTH = 12;

/** Input types that are not a field a person names. */
const UNNAMEABLE_TYPES = new Set(["hidden", "submit", "reset", "image"]);

function attrMap(opening) {
  const out = new Map();
  for (const a of opening.attributes.properties) {
    if (!ts.isJsxAttribute(a) || !a.name) continue;
    out.set(a.name.getText(), a.initializer ?? null);
  }
  return out;
}

/** A literal attribute value, or null when it is an expression we cannot read. */
function literalValue(init) {
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  }
  return null;
}

/**
 * The comparison key for "is this name just the placeholder": case-folded,
 * trimmed, and stripped of a trailing ellipsis, full stop or colon, which is
 * exactly how the twenty offenders differed from their placeholders.
 */
export function normaliseName(text) {
  return String(text)
    .toLowerCase()
    .replace(/[\s.…:]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does this subtree render text no matter which way its conditionals fall? */
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
  if (ts.isConditionalExpression(node)) {
    return rendersText(node.whenTrue) && rendersText(node.whenFalse);
  }
  if (ts.isBinaryExpression(node)) {
    const op = node.operatorToken.kind;
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return false;
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
      return rendersText(node.left) && rendersText(node.right);
    }
  }
  if (ts.isParenthesizedExpression(node)) return rendersText(node.expression);
  // Identifiers, calls, templates: assume they render. Optimism is deliberate
  // and asymmetric — a missed offender is a gap, a false alarm is a gate people
  // delete.
  return true;
}

/**
 * Classify one file's form controls.
 *
 * Exported so the companion test can drive it with fixtures rather than only
 * over the tree.
 */
export function classifyControls(sourceText, fileName = "x.tsx") {
  const sf = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const lines = sourceText.split(/\r?\n/);
  const out = { controls: 0, unnamed: [], placeholderOnly: [] };

  // Pass one: every id a <label htmlFor> in this file points at. Cross-element
  // and therefore invisible to any line-oriented matcher.
  const labelledIds = new Set();
  const collectLabels = (node) => {
    let opening = null;
    if (ts.isJsxElement(node)) opening = node.openingElement;
    else if (ts.isJsxSelfClosingElement(node)) opening = node;
    if (opening && opening.tagName.getText() === "label") {
      const forId = literalValue(attrMap(opening).get("htmlFor"));
      if (forId) labelledIds.add(forId);
    }
    ts.forEachChild(node, collectLabels);
  };
  collectLabels(sf);

  const exempt = (line1) => {
    const prev = lines[line1 - 2] ?? "";
    if (!prev.includes(PRAGMA)) return false;
    const reason = prev.split("--").slice(1).join("--").trim();
    return reason.length >= MIN_REASON_LENGTH;
  };

  // Pass two: the controls. `insideLabel` carries the wrapping form of
  // labelling — <label>Name <input /></label> — which is as valid as htmlFor
  // and just as invisible to a regex.
  const visit = (node, insideTextLabel) => {
    let opening = null;
    if (ts.isJsxElement(node)) {
      opening = node.openingElement;
    } else if (ts.isJsxSelfClosingElement(node)) {
      opening = node;
    }

    let nowInsideTextLabel = insideTextLabel;
    if (opening && opening.tagName.getText() === "label" && ts.isJsxElement(node)) {
      if (node.children.some(rendersText)) nowInsideTextLabel = true;
    }

    if (opening && CONTROL_TAGS.has(opening.tagName.getText())) {
      const attrs = attrMap(opening);
      const type = literalValue(attrs.get("type"));
      if (!type || !UNNAMEABLE_TYPES.has(type)) {
        out.controls += 1;
        const line = sf.getLineAndCharacterOfPosition(opening.getStart(sf)).line + 1;
        const id = literalValue(attrs.get("id"));
        // A placeholder pasted into aria-label is still a placeholder. Twenty
        // controls satisfied this gate with aria-label="Search skills..."
        // beside placeholder="Search skills...", and the gate's own first
        // sentence says why that is not a name (T-0096, D118). A name
        // attribute whose literal text is the placeholder's, give or take
        // case and a trailing ellipsis, does not count; an expression we
        // cannot read keeps the gate's usual optimism.
        const placeholder = literalValue(attrs.get("placeholder"));
        const namedByAttr = [...attrs.keys()].some((a) => {
          if (!NAME_ATTRS.has(a)) return false;
          if (a === "aria-labelledby" || placeholder === null) return true;
          const value = literalValue(attrs.get(a));
          if (value === null) return true;
          return normaliseName(value) !== normaliseName(placeholder);
        });
        const named =
          namedByAttr ||
          (id !== null && labelledIds.has(id)) ||
          insideTextLabel;

        if (!named && !exempt(line)) {
          const entry = { line, tag: opening.tagName.getText() };
          out.unnamed.push(entry);
          // Reported separately because it is the commonest and most
          // confidently-wrong case: the author believed they HAD labelled it.
          if (attrs.has("placeholder")) out.placeholderOnly.push(entry);
        }
      }
    }

    ts.forEachChild(node, (child) => visit(child, nowInsideTextLabel));
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
  let controlsSeen = 0;
  let filesWithControls = 0;
  const offenders = [];
  let placeholderOnly = 0;

  for (const file of files) {
    const r = classifyControls(readFileSync(file, "utf-8"), file);
    controlsSeen += r.controls;
    if (r.controls > 0) filesWithControls += 1;
    placeholderOnly += r.placeholderOnly.length;
    const rel = file.slice(ROOT.length + 1).split(sep).join("/");
    for (const u of r.unnamed) offenders.push(`${rel}:${u.line} <${u.tag}>`);
  }
  return { filesScanned: files.length, filesWithControls, controlsSeen, placeholderOnly, offenders };
}

export function formatSummary(c) {
  return (
    `form-control names: ${c.controlsSeen} controls, ${c.offenders.length} unnamed ` +
    `(across ${c.filesWithControls} of ${c.filesScanned} .tsx files).`
  );
}

/**
 * Turn a scan into an exit code and the text to print.
 *
 * Separate from `main()` on purpose. The icon-button gate learned this the
 * expensive way: mutation showed that deleting a `process.exit(1)` left every
 * assertion green, because the tests all drove the CLASSIFIER and none drove
 * the verdict. A gate that reports and does not fail the build is decoration.
 */
/** The exit code and the text to print, plus `ok` for a caller that reads the decision rather than the code. */
export function verdict(counts, floors = { files: 150, controls: 40 }) {
  const v = verdictCore(counts, floors);
  return { ...v, ok: v.code === 0 };
}

function verdictCore(counts, floors) {
  if (counts.filesScanned < floors.files || counts.controlsSeen < floors.controls) {
    return {
      code: 1,
      message:
        `form-control names: refusing to pass on a population this small.\n` +
        `  files ${counts.filesScanned} (floor ${floors.files}), ` +
        `controls ${counts.controlsSeen} (floor ${floors.controls}).\n` +
        `Either the tree moved or the matcher stopped matching. A guard that\n` +
        `inspects nothing passes everything.`,
    };
  }

  if (counts.offenders.length > 0) {
    const placeholderNote = counts.placeholderOnly
      ? `\n\n${counts.placeholderOnly} of these have a placeholder. A placeholder is NOT a name:` +
        `\nit disappears as soon as the field has content, so a screen-reader user reviewing` +
        `\nwhat they typed hears nothing, and anyone returning to a half-filled form has lost` +
        `\nthe label exactly when they need it.`
      : "";
    return {
      code: 1,
      message:
        `form-control names: ${counts.offenders.length} form control(s) with no accessible name.\n\n` +
        counts.offenders.map((o) => `  ${o}`).join("\n") +
        placeholderNote +
        `\n\nGive it one of: aria-label, aria-labelledby, a <label htmlFor> pointing at its id,` +
        `\nor wrap it in a <label> that renders text.` +
        `\n\nIf a control genuinely needs no name, exempt the line above it with:` +
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
