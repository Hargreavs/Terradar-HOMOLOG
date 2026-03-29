import { useState, useEffect, useRef } from "react";

const COLORS = {
  ambar: "#EF9F27",
  bgPrimary: "#0D0D0C",
};

const W = 1400;
const H = 800;
const CX = W / 2;
const CY = H / 2;
const SPACING = 50;
const COLS = Math.ceil(W / SPACING) + 1;
const ROWS = Math.ceil(H / SPACING) + 1;

export default function GridBreathing() {
  const [elapsed, setElapsed] = useState(0);
  const raf = useRef(null);
  const t0 = useRef(null);

  useEffect(() => {
    const tick = (ts) => {
      if (!t0.current) t0.current = ts;
      setElapsed((ts - t0.current) / 1000);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, []);

  const waveSpeed = 120;
  const waveCycle = 6;
  const waveT = elapsed % waveCycle;
  const waveRadius = waveT * waveSpeed;
  const waveWidth = 200;

  const wave2T = (elapsed + waveCycle * 0.5) % waveCycle;
  const wave2Radius = wave2T * waveSpeed;

  function getLineOpacity(dist) {
    const base = 0.03;
    const d1 = Math.abs(dist - waveRadius);
    const w1 = d1 < waveWidth ? (1 - d1 / waveWidth) * 0.04 : 0;
    const d2 = Math.abs(dist - wave2Radius);
    const w2 = d2 < waveWidth ? (1 - d2 / waveWidth) * 0.025 : 0;
    return base + w1 + w2;
  }

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 500, background: COLORS.bgPrimary, position: "relative", overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>

        {Array.from({ length: ROWS }, (_, i) => {
          const y = i * SPACING;
          const dist = Math.abs(y - CY);
          return <line key={`h${i}`} x1={0} y1={y} x2={W} y2={y} stroke={COLORS.ambar} strokeOpacity={getLineOpacity(dist)} strokeWidth={0.5} />;
        })}

        {Array.from({ length: COLS }, (_, i) => {
          const x = i * SPACING;
          const dist = Math.abs(x - CX);
          return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={H} stroke={COLORS.ambar} strokeOpacity={getLineOpacity(dist)} strokeWidth={0.5} />;
        })}

        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const x = col * SPACING;
            const y = row * SPACING;
            const dist = Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
            const d1 = Math.abs(dist - waveRadius);
            const w1 = d1 < waveWidth * 0.6 ? (1 - d1 / (waveWidth * 0.6)) * 0.15 : 0;
            const dotOp = 0.02 + w1;
            if (dotOp < 0.025) return null;
            return <circle key={`d${row}-${col}`} cx={x} cy={y} r={1} fill={COLORS.ambar} opacity={dotOp} />;
          })
        )}

        <text x={W - 25} y={H - 20} fill={COLORS.ambar} fillOpacity={0.12} fontSize={10} fontFamily="monospace" textAnchor="end" letterSpacing={4}>TERRADAR</text>
      </svg>
    </div>
  );
}
