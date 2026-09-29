// Phase 7 step 5: the one chart component for /admin/analytics (sessions by
// day, orders by day, revenue by week). Server-rendered inline SVG, no
// dependencies. Follows the dataviz guidance: one series -> no legend box (the
// title names it), 24px-max bars with a 4px rounded data end square at the
// baseline, hairline recessive grid, labels only at the axis ends and middle,
// native <title> tooltips on a full-height hit target per band, and a
// "View as table" fallback so nothing depends on colour or hover alone. One
// accent (--accent #5c5a6e, ~6.6:1 on white) — a single-series mark, so the
// categorical chroma/CVD checks do not apply. The admin is always light.

export interface BarDatum {
  label: string;
  value: number;
}

const W = 600;
const H = 170;
const PAD = { top: 12, right: 8, bottom: 24, left: 48 };
const MAX_BAR = 24;
const MAX_CORNER = 4;

// Round the axis maximum up to 1/2/5 x 10^n so the top gridline reads cleanly.
function niceMax(max: number): number {
  if (max <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((s) => max <= s * magnitude)!;
  return step * magnitude;
}

function barPath(x: number, baseline: number, width: number, height: number): string {
  const r = Math.min(MAX_CORNER, height, width / 2);
  return `M${x},${baseline}V${baseline - height + r}Q${x},${baseline - height} ${x + r},${baseline - height}H${x + width - r}Q${x + width},${baseline - height} ${x + width},${baseline - height + r}V${baseline}Z`;
}

export function BarChart({
  title,
  data,
  formatValue = (n) => String(n),
}: {
  title: string;
  data: BarDatum[];
  formatValue?: (value: number) => string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const top = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotH;
  const band = data.length > 0 ? plotW / data.length : plotW;
  const gap = Math.min(2, band * 0.25);
  const barW = Math.max(1, Math.min(MAX_BAR, band - gap));
  const yFor = (v: number) => baseline - (v / top) * plotH;
  const labelIdx = new Set([0, Math.floor((data.length - 1) / 2), data.length - 1]);

  return (
    <figure data-testid="bar-chart" className="rounded-3xl bg-surface p-4 shadow-[0_1px_0_rgba(30,31,36,0.07)]">
      <figcaption className="text-sm font-semibold text-ink">{title}</figcaption>
      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`${title}: ${formatValue(total)} in total over ${data.length} ${data.length === 1 ? "period" : "periods"}`}
          className="h-auto w-full min-w-[480px]"
        >
          {[0, top / 2, top].map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={yFor(tick)}
                y2={yFor(tick)}
                strokeWidth={1}
                className="stroke-ink/10"
              />
              <text x={PAD.left - 6} y={yFor(tick) + 4} textAnchor="end" fontSize={11} className="fill-muted">
                {formatValue(tick)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const bandX = PAD.left + i * band;
            const x = bandX + (band - barW) / 2;
            const height = (d.value / top) * plotH;
            return (
              <g key={d.label}>
                <rect x={bandX} y={PAD.top} width={band} height={plotH} fill="transparent">
                  <title>{`${d.label}: ${formatValue(d.value)}`}</title>
                </rect>
                {d.value > 0 && <path d={barPath(x, baseline, barW, height)} className="fill-accent" />}
                {labelIdx.has(i) && (
                  <text
                    x={bandX + band / 2}
                    y={H - 6}
                    textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
                    fontSize={11}
                    className="fill-muted"
                  >
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <details className="mt-1 text-sm">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted">View as table</summary>
        <table className="mt-2 w-full text-left">
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-ink/10">
                <th scope="row" className="py-1 pr-2 font-normal text-muted">
                  {d.label}
                </th>
                <td className="py-1 text-right tabular-nums">{formatValue(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
