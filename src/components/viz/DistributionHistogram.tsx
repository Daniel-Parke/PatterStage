import { neon, neonAlpha, type NeonColor } from "./colors";
import { niceMax } from "./geometry";

export interface HistogramBin {
  label: string;
  value: number;
}

interface DistributionHistogramProps {
  bins: HistogramBin[];
  color?: NeonColor;
  height?: number;
  className?: string;
}

/**
 * Vertical bar histogram for a bucketed distribution (e.g. run durations).
 *
 * HTML, not SVG, since T-0124 — and that is the fix rather than a rewrite for
 * its own sake. It was an SVG with `preserveAspectRatio="none"`, the one chart
 * in viz/ carrying TEXT inside that stretch: measured on /results/insights it
 * rendered 345px wide from a 600px viewBox, so every glyph was squashed to 57%
 * of its width at full height. T-0114 raised the sizes off 8px and 9px, which
 * made both dimensions larger and left the ratio exactly where it was.
 *
 * The note left there offered two fixes: teach the chart its own rendered width
 * with a ResizeObserver, or move the labels out of the stretch. This is the
 * second, taken further — a bar chart is a row of rectangles with a number
 * over each and a word under it, and none of that needs a coordinate system.
 * As HTML the bars flex to whatever width they are given, the labels are real
 * text on the type scale that `no-sub-12px-type` can see, and the distortion
 * cannot come back because there is no viewBox to disagree with.
 *
 * The `height` prop is the PLOT height, as it was; labels sit under it.
 */
export default function DistributionHistogram({
  bins,
  color = "purple",
  height = 140,
  className,
}: DistributionHistogramProps) {
  // The axis is drawn whether or not there is anything on it, so an empty
  // distribution reads as "nothing yet" rather than as a missing component.
  const max = bins.length > 0 ? niceMax(Math.max(...bins.map((b) => b.value))) : 1;

  return (
    <div className={className}>
      {/* The axis is `ps-edge-hairline`, not `ps-viz-axis`. Moving out of SVG
          turned a stroke into a real border, and the live contrast gate could
          suddenly see it: white at 8% composites to 1.27:1 on the panel,
          against the 1.55 a boundary needs to be visible at all. An axis IS a
          subdivision inside one surface, which is what the hairline rung is
          for, so this is the token that was always right. The other two charts
          still stroke `ps-viz-axis` at 1.27:1 and no gate can see them; that is
          recorded for the viz pass rather than changed from here (T-0124). */}
      <div
        className="flex items-end gap-2 border-b border-ps-edge-hairline"
        style={{ height }}
        role="img"
        aria-label={
          bins.length === 0
            ? "No distribution recorded yet"
            : bins.map((b) => `${b.label}: ${b.value}`).join(", ")
        }
      >
        {bins.map((b) => (
          <div key={b.label} className="flex min-w-0 flex-1 flex-col items-center justify-end">
            {b.value > 0 && (
              <div className="mb-1 font-mono text-micro tabular-nums" style={{ color: neon(color) }}>
                {b.value}
              </div>
            )}
            <div
              title={`${b.label}: ${b.value}`}
              className="w-full max-w-12 rounded-t-ps-sm border border-b-0 transition-[height] duration-500"
              style={{
                // A bar with a real value is never invisible: 2px is the floor,
                // so "one run in this bucket" is a mark rather than nothing.
                height: b.value > 0 ? `max(2px, ${(b.value / max) * 100}%)` : 0,
                background: neonAlpha(color, 55),
                borderColor: neonAlpha(color, 80),
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {bins.map((b) => (
          <div
            key={b.label}
            className="min-w-0 flex-1 truncate text-center font-mono text-micro text-ps-text-faint"
            title={b.label}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}
