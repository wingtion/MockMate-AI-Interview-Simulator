import { useId } from 'react';

export interface ScorePoint {
    coding: number;
    communication: number | null; // null for practice problems (no communication score)
}

// Dependency-free SVG line chart of scores over time (oldest → newest).
export default function ScoreChart({ data }: { data: ScorePoint[] }) {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, ''); // safe inside url(#...)
    const codId = `codFill-${uid}`;
    const comId = `comFill-${uid}`;
    const W = 640;
    const H = 240;
    const padX = 34;
    const padY = 22;
    const MAX = 10;
    const innerW = W - padX * 2;
    const innerH = H - padY * 2;
    const n = data.length;

    const x = (i: number) => (n <= 1 ? padX + innerW / 2 : padX + (i / (n - 1)) * innerW);
    const y = (v: number) => padY + innerH - (Math.max(0, Math.min(MAX, v)) / MAX) * innerH;

    const codingPts = data.map((d, i) => [x(i), y(d.coding)] as const);
    // Communication only exists for interviews; its line joins those points and skips practice.
    const commPts = data.flatMap((d, i) => (d.communication === null ? [] : [[x(i), y(d.communication)] as const]));

    const line = (pts: readonly (readonly [number, number])[]) => pts.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
    const area = (pts: readonly (readonly [number, number])[]) =>
        pts.length < 2 ? '' : `${pts[0][0].toFixed(1)},${y(0).toFixed(1)} ${line(pts)} ${pts[pts.length - 1][0].toFixed(1)},${y(0).toFixed(1)}`;

    const label = commPts.length
        ? `Coding scores over ${n} sessions and communication scores over ${commPts.length} interviews, oldest to newest`
        : `Coding scores over ${n} sessions, oldest to newest`;

    return (
        <svg className="score-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
            <defs>
                <linearGradient id={codId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className="chart-stop coding" stopOpacity="0.28" />
                    <stop offset="100%" className="chart-stop coding" stopOpacity="0" />
                </linearGradient>
                <linearGradient id={comId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" className="chart-stop comm" stopOpacity="0.14" />
                    <stop offset="100%" className="chart-stop comm" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* horizontal grid + axis labels */}
            {[0, 5, 10].map((v) => (
                <g key={v}>
                    <line className="chart-grid" x1={padX} x2={W - padX} y1={y(v)} y2={y(v)} />
                    <text className="chart-axis" x={padX - 8} y={y(v) + 4} textAnchor="end">{v}</text>
                </g>
            ))}

            {/* area fills (only meaningful with 2+ points) */}
            {commPts.length > 1 && <polygon points={area(commPts)} fill={`url(#${comId})`} />}
            {codingPts.length > 1 && <polygon points={area(codingPts)} fill={`url(#${codId})`} />}

            {/* series */}
            {commPts.length > 0 && <polyline className="chart-line comm" points={line(commPts)} />}
            <polyline className="chart-line coding" points={line(codingPts)} />

            {/* points */}
            {commPts.map(([px, py], i) => (
                <circle key={`comm-${i}`} className="chart-dot comm" cx={px} cy={py} r={3.5} />
            ))}
            {codingPts.map(([px, py], i) => (
                <circle key={`cod-${i}`} className="chart-dot coding" cx={px} cy={py} r={3.5} />
            ))}
        </svg>
    );
}
