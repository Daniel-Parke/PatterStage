/**
 * The reading half of the design census (U0, T-0114).
 *
 * This function is handed to `page.evaluate`, so it is serialised to source and
 * re-parsed inside the browser: it may not close over anything, may not import
 * anything at run time, and every helper it uses has to live inside it. That is
 * ugly and it is the price of measuring what was actually painted rather than
 * what the source says should have been.
 *
 * It reads and normalises. It never composites, never divides and never decides
 * whether a number is good: all of that is in census-analysis.ts, where jest can
 * check it against hand-computed values.
 *
 * The one hard part is colour. Tailwind v4 emits `color-mix(in oklab, …)` for
 * every `bg-dark-900/40`, and `getComputedStyle` hands that back as `oklab(…)`.
 * A regex parser skips it silently, which is how a contrast audit ends up
 * reporting zero for the wrong reason. So every colour is painted into a 1x1
 * canvas and read back as bytes: that is the engine's own answer, in the same
 * 8-bit space the screen gets, for any syntax the engine can parse. Results are
 * memoised per distinct colour string, because `getImageData` is a readback and
 * a dense route has thousands of elements but only a hundred or so colours.
 */
import type { RawCensus } from "./census-analysis";

/**
 * Runs inside the page. `route` is passed in because `location.pathname` has
 * already been rewritten by the time a redirect settles.
 */
export function collectCensus(route: string): RawCensus {
  const INTERACTIVE =
    'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

  // ── colour, via the engine ────────────────────────────────────────────────
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const cache = new Map<string, string | null>();

  /** `rgba(r, g, b, a)` for anything the engine can parse, else null. */
  function toRgba(value: string | null | undefined): string | null {
    if (!value) return null;
    const key = value;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let out: string | null = null;
    if (ctx) {
      // Two sentinels: an unparseable value leaves fillStyle untouched, so a
      // value that "sticks" to whichever sentinel preceded it is invalid.
      ctx.fillStyle = "#000000";
      ctx.fillStyle = value;
      const first = ctx.fillStyle;
      ctx.fillStyle = "#ffffff";
      ctx.fillStyle = value;
      const second = ctx.fillStyle;
      if (first === second) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        const a = Math.round((d[3] / 255) * 1000) / 1000;
        out = `rgba(${d[0]}, ${d[1]}, ${d[2]}, ${a})`;
      }
    }
    cache.set(key, out);
    return out;
  }

  /** True when the colour paints nothing at all. */
  function invisible(rgba: string | null): boolean {
    if (!rgba) return true;
    const m = /rgba\(\d+, \d+, \d+, ([\d.]+)\)/.exec(rgba);
    return m ? Number(m[1]) === 0 : false;
  }

  /**
   * Every background from an element outward, innermost first, skipping the
   * ones that paint nothing. This is what census-analysis flattens; collecting
   * the stack rather than a composited answer is what keeps the compositing
   * testable.
   */
  function backdropStack(el: Element): string[] {
    const out: string[] = [];
    let node: Element | null = el.parentElement;
    while (node) {
      const bg = toRgba(getComputedStyle(node).backgroundColor);
      if (!invisible(bg) && bg) out.push(bg);
      node = node.parentElement;
    }
    return out;
  }

  const isVisible = (el: Element, rect: DOMRect): boolean => {
    if (rect.width <= 0 || rect.height <= 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0;
  };

  const rail = document.querySelector('aside[data-testid="app-rail"]');
  const main = document.querySelector("main");
  const header = main ? main.querySelector("header") : null;
  const heading = document.querySelector("h1");

  const result: RawCensus = {
    route,
    borders: [],
    text: [],
    boxes: [],
    geometry: {
      route,
      headingLeft: null,
      contentLeft: null,
      contentLeftWhat: null,
      blockLefts: [],
      contentWidth: null,
      overflowX: main ? Math.max(0, main.scrollWidth - main.clientWidth) : 0,
    },
    pageBackground: toRgba(getComputedStyle(document.body).backgroundColor) ?? "rgba(0, 0, 0, 1)",
    railBackground: rail ? toRgba(getComputedStyle(rail).backgroundColor) : null,
    railDivider: rail ? toRgba(getComputedStyle(rail).borderRightColor) : null,
  };

  // A rail whose divider is declared but zero-width is not a divider.
  if (rail && parseFloat(getComputedStyle(rail).borderRightWidth) === 0) result.railDivider = null;

  /** A short, stable name for a node, so a regression can be found again. */
  /**
   * WCAG 2.5.8's "in a sentence": the control, or the inline wrapper it sits
   * in, has words for siblings. Walk up through inline-level ancestors to the
   * block that holds it and ask whether that block has text of its own.
   */
  function inSentence(el: Element): boolean {
    let node: Element = el;
    while (node.parentElement && /^inline/.test(getComputedStyle(node.parentElement).display)) {
      node = node.parentElement;
    }
    const block = node.parentElement;
    if (!block) return false;
    return Array.from(block.childNodes).some(
      (n) => n.nodeType === 3 && (n.textContent ?? "").trim().length > 0,
    );
  }

  /**
   * The box a stretched link really covers. A link whose ::after is
   * positioned absolute has been stretched over its nearest positioned
   * ancestor (the `after:absolute after:inset-0` idiom on a list row), and
   * that ancestor is the target a finger meets.
   */
  function stretchedTargetOf(el: Element): DOMRect | null {
    const after = getComputedStyle(el, "::after");
    if (after.position !== "absolute" || after.content === "none" || after.content === "normal") return null;
    let p = el.parentElement;
    while (p && getComputedStyle(p).position === "static") p = p.parentElement;
    return p ? p.getBoundingClientRect() : null;
  }

  function describe(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const testid = el.getAttribute("data-testid");
    if (testid) return `${tag}[${testid}]`;
    const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 3).join(".");
    const text = (el.textContent ?? "").trim().slice(0, 24);
    return cls ? `${tag}.${cls}` : text ? `${tag}:${text}` : tag;
  }

  // Left edges of everything that reads as page content, for the dominant
  // gutter. The dominant edge is used rather than the first, because the first
  // sizeable node under main is usually the padding wrapper, whose left is the
  // column's, not the content's.
  const contentLefts: number[] = [];
  const contentBlocks: Array<{ left: number; top: number; height: number; what: string }> = [];
  // The elements already counted as content blocks. A painted region inside
  // one of these is its CONTENTS - a log line, a table cell, a row - and a
  // page whose terminal pane holds four hundred of them would otherwise report
  // the pane's inner left as the page's content column.
  const countedBlocks: HTMLElement[] = [];
  const contentBlockNames = new Map<number, string>();
  let widestContainer = 0;

  const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
  for (const el of all) {
    const rect = el.getBoundingClientRect();
    if (!isVisible(el, rect)) continue;
    const style = getComputedStyle(el);

    const inHeader = header ? header.contains(el) : false;
    const inRail = rail ? rail.contains(el) : false;
    // The element ITSELF, not anything inside one. A 40x40 button holding a
    // 16px icon is one control, and `closest()` counted it as two, one of them
    // failing the hit-target floor: the first census returned 3,857 small
    // targets against the walk's 127, all of them icons and spans (T-0114).
    const control = el.matches(INTERACTIVE);
    const insideControl = !control && el.closest(INTERACTIVE) !== null;

    // ── text ───────────────────────────────────────────────────────────────
    // Only elements with their OWN text, so a wrapper does not count its
    // children's words a second time.
    let ownText = "";
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === 3) ownText += node.textContent ?? "";
    }
    if (ownText.trim().length > 0) {
      result.text.push({
        route,
        size: Math.round(parseFloat(style.fontSize) * 100) / 100,
        mono: /mono/i.test(style.fontFamily),
      });
    }

    // ── borders ────────────────────────────────────────────────────────────
    const widths = [
      parseFloat(style.borderTopWidth),
      parseFloat(style.borderRightWidth),
      parseFloat(style.borderBottomWidth),
      parseFloat(style.borderLeftWidth),
    ];
    const colours = [
      style.borderTopColor,
      style.borderRightColor,
      style.borderBottomColor,
      style.borderLeftColor,
    ];
    let borderColour: string | null = null;
    for (let i = 0; i < 4; i++) {
      if (widths[i] > 0) {
        const c = toRgba(colours[i]);
        if (!invisible(c)) {
          borderColour = c;
          break;
        }
      }
    }
    if (borderColour) {
      result.borders.push({
        route,
        what: describe(el),
        colour: borderColour,
        backdrop: backdropStack(el),
        control,
      });
    }

    // ── boxes: surfaces and controls ───────────────────────────────────────
    const bg = toRgba(style.backgroundColor);
    const radius = style.borderRadius;
    const shadow = style.boxShadow;
    // A surface is a thing the eye reads as a container: it has an edge, or a
    // fill with a corner, and it is big enough to be a panel rather than a dot.
    // Chrome inside a control belongs to the control, not to the card census.
    const inProse = control && (style.display === "inline" || inSentence(el));
    const clipped = control && style.position === "absolute" && rect.width <= 1 && rect.height <= 1;
    const exempt = inProse || clipped;
    const target = (control && stretchedTargetOf(el)) || rect;
    const isSurface =
      !control &&
      !insideControl &&
      rect.width >= 24 &&
      rect.height >= 24 &&
      (Boolean(borderColour) || (!invisible(bg) && radius !== "0px"));
    if (control || isSurface) {
      result.boxes.push({
        route,
        what: describe(el),
        chrome:
          borderColour || !invisible(bg)
            ? `${radius}|${borderColour ?? "none"}|${invisible(bg) ? "none" : bg}`
            : "",
        radius: radius === "0px" ? "" : radius,
        height: Math.round(rect.height * 100) / 100,
        shadow,
        zIndex: style.position === "static" ? "auto" : style.zIndex,
        control,
        // WCAG 2.5.8's own exemptions, and no others (T-0128). Inline in a
        // sentence: a control whose box is the line rather than the control
        // (`display: inline`), or one set among the words of its block, which
        // is what a concept hint is. Not on the screen: a skip link clipped to
        // a pixel until it is focused. A stretched link: its target is the row
        // it covers, so the row is what is measured.
        w: !control || exempt ? 0 : Math.round(target.width * 100) / 100,
        h: !control || exempt ? 0 : Math.round(target.height * 100) / 100,
      });
    }

    // ── geometry ───────────────────────────────────────────────────────────
    if (main && !inHeader && !inRail && main.contains(el) && rect.width >= 200 && rect.height >= 20) {
      const paints = Boolean(borderColour) || !invisible(bg) || ownText.trim().length > 0;
      // A region painted in the page's own background, with no border, is the
      // GROUND rather than a block on it: it has no edge, so nothing lines up
      // with it. AppPageShell's root is exactly that, and being outermost it
      // would otherwise swallow every real block inside it.
      const isGround = !borderColour && ownText.trim().length === 0 && bg === result.pageBackground;
      if (paints && !isGround && !countedBlocks.some((b) => b.contains(el))) {
        const left = Math.round(rect.left);
        contentLefts.push(left);
        countedBlocks.push(el);
        contentBlocks.push({
          left,
          top: Math.round(rect.top),
          height: Math.round(rect.height),
          what: describe(el),
        });
        if (!contentBlockNames.has(left)) contentBlockNames.set(left, describe(el));
      }
      if (style.maxWidth !== "none") {
        widestContainer = Math.max(widestContainer, Math.round(rect.width));
      }
    }
  }

  if (heading) {
    const r = heading.getBoundingClientRect();
    if (r.width > 0) result.geometry.headingLeft = Math.round(r.left);
  }

  if (contentLefts.length > 0) {
    // The LEFTMOST, not the commonest. A vote elects whatever a page happens to
    // repeat: on /work/missions the <h2> inside each card outnumbered the cards
    // themselves and won by 24px, which is the cards' padding and not a
    // misalignment. The column's left edge is the leftmost edge its content
    // reaches, and a card always beats its own heading.
    const best = Math.min(...contentLefts);
    result.geometry.contentLeft = best;
    result.geometry.contentLeftWhat = contentBlockNames.get(best) ?? null;
    // Every content block, with where it starts and how tall it is, so
    // `splitBlocks` can group them into rows before comparing their lefts. A
    // grid's second column is a block at a different left and is not a defect.
    result.geometry.blockLefts = contentBlocks;
  }

  result.geometry.contentWidth =
    widestContainer > 0 ? widestContainer : main ? Math.round(main.clientWidth) : null;

  return result;
}
