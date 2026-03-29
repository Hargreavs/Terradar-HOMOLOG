import { useState, useEffect, useRef } from "react";

const COLORS = {
  ambar: "#EF9F27",
  ambarLight: "#F1B85A",
  verde: "#1D9E75",
  textPrimary: "#F1EFE8",
  textSecondary: "#888780",
  bgPrimary: "#0D0D0C",
  border: "#2C2C2A",
};

const MINERALS = [
  { label: "Fe", color: "#7EADD4", x: -520, y: -180 },
  { label: "Cu", color: "#C87C5B", x: 480, y: -220 },
  { label: "Au", color: "#D4A843", x: -350, y: 160 },
  { label: "Nb", color: "#5CBFA0", x: 280, y: -320 },
  { label: "TR", color: "#3D8B7A", x: -180, y: 280 },
  { label: "Li", color: "#9BB8D0", x: 550, y: 120 },
  { label: "Ni", color: "#8FAA8D", x: -450, y: -300 },
  { label: "Bx", color: "#B8917A", x: 380, y: 260 },
  { label: "Qz", color: "#C4B89A", x: -80, y: -380 },
  { label: "Fe", color: "#7EADD4", x: 150, y: 350 },
  { label: "Cu", color: "#C87C5B", x: -600, y: 50 },
  { label: "Au", color: "#D4A843", x: 620, y: -80 },
  { label: "Nb", color: "#5CBFA0", x: -280, y: -150 },
  { label: "Li", color: "#9BB8D0", x: 420, y: 380 },
];

const MINERAL_NAMES = ["FERRO","COBRE","OURO","NIÓBIO","TERRAS RARAS","LÍTIO","NÍQUEL","BAUXITA","QUARTZO","FERRO","COBRE","OURO","NIÓBIO","LÍTIO"];

const W = 1400;
const H = 700;
const CX = W / 2;
const CY = H / 2;
const RADII = [60, 120, 180, 240, 300, 380];

function angleBetween(cx, cy, px, py) {
  return Math.atan2(py - cy, px - cx) * 180 / Math.PI;
}

function angleDiff(a, b) {
  let d = ((b - a + 180) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

export default function RadarBackground() {
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

  const sweep = (elapsed * 72) % 360;
  const pulse = 1 + 0.2 * Math.abs(Math.sin(elapsed * Math.PI * 0.5));
  const rp1 = (elapsed * 0.4) % 1;
  const rp2 = ((elapsed + 1.2) * 0.4) % 1;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 500, background: COLORS.bgPrimary, position: "relative", overflow: "hidden", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="sweepBg" cx="0" cy="0" r="1">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.22" />
            <stop offset="60%" stopColor={COLORS.ambar} stopOpacity="0.05" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="centerBg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.06" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <mask id="sweepM">
            <rect width={W} height={H} fill="black" />
            {(() => {
              const a1 = ((sweep - 35) * Math.PI) / 180;
              const a2 = ((sweep + 35) * Math.PI) / 180;
              const r = 500;
              return <path d={`M ${CX} ${CY} L ${CX + r * Math.cos(a1)} ${CY + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(a2)} ${CY + r * Math.sin(a2)} Z`} fill="white" />;
            })()}
          </mask>
          <filter id="gl"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="sgl"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <circle cx={CX} cy={CY} r={320} fill="url(#centerBg)" />

        {Array.from({ length: Math.ceil(H / 50) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 50} x2={W} y2={i * 50} stroke={COLORS.ambar} strokeOpacity={0.025} strokeWidth={0.5} />)}
        {Array.from({ length: Math.ceil(W / 50) + 1 }, (_, i) => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={H} stroke={COLORS.ambar} strokeOpacity={0.025} strokeWidth={0.5} />)}

        {RADII.map(r => <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={COLORS.ambar} strokeOpacity={0.06} strokeWidth={0.6} strokeDasharray={r > 300 ? "4 6" : "none"} />)}

        <line x1={CX} y1={0} x2={CX} y2={H} stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} />
        <line x1={0} y1={CY} x2={W} y2={CY} stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} />
        <line x1={CX - 350} y1={CY - 350} x2={CX + 350} y2={CY + 350} stroke={COLORS.ambar} strokeOpacity={0.02} strokeWidth={0.5} />
        <line x1={CX + 350} y1={CY - 350} x2={CX - 350} y2={CY + 350} stroke={COLORS.ambar} strokeOpacity={0.02} strokeWidth={0.5} />

        <circle cx={CX} cy={CY} r={460} fill="url(#sweepBg)" mask="url(#sweepM)" />
        {(() => { const a = ((sweep + 35) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 460 * Math.cos(a)} y2={CY + 460 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.3} strokeWidth={0.8} />; })()}
        {(() => { const a = ((sweep - 35) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 460 * Math.cos(a)} y2={CY + 460 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.08} strokeWidth={0.4} />; })()}

        <circle cx={CX} cy={CY} r={8 * (1 + rp1 * 8)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.2 * (1 - rp1)} strokeWidth={0.6} />
        <circle cx={CX} cy={CY} r={8 * (1 + rp2 * 8)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.12 * (1 - rp2)} strokeWidth={0.5} />

        {MINERALS.map((m, i) => {
          const px = CX + m.x;
          const py = CY + m.y;
          const floatY = Math.sin(elapsed * 0.2 + i * 1.1) * 3;
          const floatX = Math.cos(elapsed * 0.15 + i * 0.8) * 2;
          const fpx = px + floatX;
          const fpy = py + floatY;

          const mineralAngle = angleBetween(CX, CY, px, py);
          const diff = Math.abs(angleDiff(sweep, mineralAngle));
          const inBeam = diff < 55;
          const beam = inBeam ? Math.max(0, 1 - diff / 55) : 0;

          const baseOp = 0.05;
          const revealOp = baseOp + 0.4 * beam;
          const sz = 42;
          const s = sz * (1 + 0.02 * Math.sin(elapsed * 0.8 + i));

          return (
            <g key={i}>
              <line x1={fpx} y1={fpy} x2={CX} y2={CY} stroke={m.color} strokeOpacity={0.02 + 0.04 * beam} strokeWidth={0.4} strokeDasharray="3 6" />
              {beam > 0.3 && <circle cx={fpx} cy={fpy} r={s * 0.8} fill={m.color} opacity={0.06 * beam} filter="url(#sgl)" />}
              <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={5} fill={COLORS.bgPrimary} stroke={m.color} strokeWidth={inBeam ? 1 : 0.5} strokeOpacity={baseOp + 0.45 * beam} opacity={revealOp} />
              <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={5} fill={m.color} opacity={0.02 + 0.08 * beam} />
              <text x={fpx} y={fpy + 1} fill={m.color} fontSize={15} fontWeight={600} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" dominantBaseline="middle" opacity={0.04 + 0.8 * beam} letterSpacing={0.5}>{m.label}</text>
              <text x={fpx} y={fpy + s / 2 + 13} fill={m.color} fontSize={7} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" letterSpacing={1.5} opacity={0.03 + 0.5 * beam}>{MINERAL_NAMES[i]}</text>
              <circle cx={fpx + s / 2 - 5} cy={fpy - s / 2 + 5} r={2} fill={m.color} opacity={0.05 + 0.6 * beam} />
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={5 * pulse} fill={COLORS.ambar} filter="url(#gl)" opacity={0.7} />
        <circle cx={CX} cy={CY} r={3} fill={COLORS.ambarLight} />
        <circle cx={CX} cy={CY} r={1.5} fill="white" opacity={0.5} />

        {RADII.filter(r => r > 100).map(r => <text key={`l${r}`} x={CX + r + 4} y={CY - 4} fill={COLORS.ambar} fillOpacity={0.08} fontSize={7} fontFamily="monospace">{r}km</text>)}

        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180;
          const major = i % 18 === 0;
          const minor = i % 9 === 0;
          const inn = major ? 375 : minor ? 378 : 382;
          return <line key={`t${i}`} x1={CX + inn * Math.cos(a)} y1={CY + inn * Math.sin(a)} x2={CX + 385 * Math.cos(a)} y2={CY + 385 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={major ? 0.15 : minor ? 0.07 : 0.03} strokeWidth={major ? 0.7 : 0.3} />;
        })}

        {[{ l: "N", a: -90 }, { l: "S", a: 90 }, { l: "E", a: 0 }, { l: "W", a: 180 }].map(({ l, a }) => {
          const rad = (a * Math.PI) / 180;
          return <text key={l} x={CX + 400 * Math.cos(rad)} y={CY + 400 * Math.sin(rad) + 3} fill={COLORS.ambar} fillOpacity={0.08} fontSize={8} fontFamily="monospace" textAnchor="middle" letterSpacing={2}>{l}</text>;
        })}
      </svg>

      <div style={{ position: "absolute", top: 20, left: 28, right: 28, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.verde, boxShadow: `0 0 8px ${COLORS.verde}` }} />
          <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary }}>Radar Terrae</span>
        </div>
        <span style={{ fontSize: 10, letterSpacing: 1.5, color: COLORS.ambar, opacity: 0.25, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
          {Math.floor(sweep).toString().padStart(3, "0")}°
        </span>
      </div>

      <div style={{ position: "absolute", bottom: 20, right: 28 }}>
        <span style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: COLORS.ambar, opacity: 0.08 }}>TERRAE</span>
      </div>
    </div>
  );
}
