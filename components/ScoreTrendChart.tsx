"use client";

// Lightweight dependency-free SVG line chart for score-over-time. No charting library
// needed for a single trend line, and it keeps the app's dependency footprint (and thus
// install risk) small.

interface Point {
  score: number;
  label: string;
}

export default function ScoreTrendChart({ points }: { points: Point[] }) {
  const width = 640;
  const height = 200;
  const padX = 28;
  const padY = 24;

  if (points.length === 0) return null;

  if (points.length === 1) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-slate-500">
        Complete another interview to start seeing your trend.
      </div>
    );
  }

  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xy = points.map((p, i) => {
    const x = padX + i * stepX;
    const y = padY + innerH - (Math.max(0, Math.min(100, p.score)) / 100) * innerH;
    return { x, y, ...p };
  });

  const linePath = xy.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xy[xy.length - 1].x.toFixed(1)} ${padY + innerH} L ${xy[0].x.toFixed(1)} ${padY + innerH} Z`;

  const gridLines = [0, 25, 50, 75, 100];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[200px] w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridLines.map((g) => {
        const y = padY + innerH - (g / 100) * innerH;
        return (
          <g key={g}>
            <line x1={padX} x2={width - padX} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />
            <text x={2} y={y + 3} fontSize={9} fill="#64748b">
              {g}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill="url(#trendFill)" stroke="none" />
      <path d={linePath} fill="none" stroke="#818cf8" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill="#0f172a" stroke="#818cf8" strokeWidth={2} />
          <title>
            {p.label}: {p.score}
          </title>
        </g>
      ))}
    </svg>
  );
}
