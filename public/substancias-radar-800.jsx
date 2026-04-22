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
  { label: "Fe", name: "Ferro", color: "#7EADD4", x: 100, y: -160 },
  { label: "Cu", name: "Cobre", color: "#C87C5B", x: -80, y: -110 },
  { label: "Au", name: "Ouro", color: "#D4A843", x: 166, y: 72 },
  { label: "Nb", name: "Nióbio", color: "#5CBFA0", x: -137, y: 144 },
  { label: "TR", name: "Terras Raras", color: "#3D8B7A", x: 58, y: 230 },
  { label: "Li", name: "Lítio", color: "#9BB8D0", x: -173, y: -58 },
  { label: "Ni", name: "Níquel", color: "#8FAA8D", x: 122, y: -252 },
  { label: "Bx", name: "Bauxita", color: "#B8917A", x: -43, y: 288 },
  { label: "Qz", name: "Quartzo", color: "#C4B89A", x: 144, y: -36 },
];

const W = 800;
const H = 800;
const CX = 400;
const CY = 400;
const RADII = [80, 160, 240, 320];

function angleBetween(cx, cy, px, py) {
  return Math.atan2(py - cy, px - cx) * 180 / Math.PI;
}
function angleDiff(a, b) {
  let d = ((b - a + 180) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

export default function SubstanciasRadar800() {
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

  const sweepAngle = (elapsed * 90) % 360;
  const pulseScale = 1 + 0.25 * Math.abs(Math.sin(elapsed * Math.PI * 0.67));
  const rp1 = (elapsed * 0.5) % 1;
  const rp2 = ((elapsed + 0.9) * 0.5) % 1;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: COLORS.bgPrimary, position: "relative", overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="sg2q" cx="0" cy="0" r="1">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.22" />
            <stop offset="60%" stopColor={COLORS.ambar} stopOpacity="0.05" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cg2q" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.06" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <mask id="sm2q">
            <rect width={W} height={H} fill="black" />
            {(() => {
              const a1 = ((sweepAngle - 40) * Math.PI) / 180, a2 = ((sweepAngle + 40) * Math.PI) / 180, r = 400;
              return <path d={`M ${CX} ${CY} L ${CX + r * Math.cos(a1)} ${CY + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(a2)} ${CY + r * Math.sin(a2)} Z`} fill="white" />;
            })()}
          </mask>
          <filter id="gl2q"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="sgl2q"><feGaussianBlur stdDeviation="12" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <circle cx={CX} cy={CY} r={300} fill="url(#cg2q)" />

        {Array.from({ length: Math.ceil(H / 45) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 45} x2={W} y2={i * 45} stroke={COLORS.ambar} strokeOpacity={0.03} strokeWidth={0.5} />)}
        {Array.from({ length: Math.ceil(W / 45) + 1 }, (_, i) => <line key={`v${i}`} x1={i * 45} y1={0} x2={i * 45} y2={H} stroke={COLORS.ambar} strokeOpacity={0.03} strokeWidth={0.5} />)}

        {RADII.map(r => <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={COLORS.ambar} strokeOpacity={0.06} strokeWidth={0.6} strokeDasharray={r > 320 ? "4 6" : "none"} />)}

        <line x1={CX} y1={CY - 370} x2={CX} y2={CY + 370} stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} />
        <line x1={CX - 370} y1={CY} x2={CX + 370} y2={CY} stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} />

        <circle cx={CX} cy={CY} r={370} fill="url(#sg2q)" mask="url(#sm2q)" />
        {(() => { const a = ((sweepAngle + 40) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 370 * Math.cos(a)} y2={CY + 370 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.35} strokeWidth={0.8} />; })()}
        {(() => { const a = ((sweepAngle - 40) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 370 * Math.cos(a)} y2={CY + 370 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.08} strokeWidth={0.4} />; })()}

        <circle cx={CX} cy={CY} r={8 * (1 + rp1 * 6)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.25 * (1 - rp1)} strokeWidth={0.6} />
        <circle cx={CX} cy={CY} r={8 * (1 + rp2 * 6)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.15 * (1 - rp2)} strokeWidth={0.5} />

        {MINERALS.map((m, i) => {
          const px = CX + m.x, py = CY + m.y;
          const floatY = Math.sin(elapsed * 0.4 + i * 0.8) * 4;
          const floatX = Math.cos(elapsed * 0.3 + i * 0.6) * 3;
          const fpx = px + floatX, fpy = py + floatY;
          const mineralAngle = angleBetween(CX, CY, px, py);
          const diff = Math.abs(angleDiff(sweepAngle, mineralAngle));
          const inBeam = diff < 50;
          const beam = inBeam ? Math.max(0, 1 - diff / 50) : 0;
          const baseOp = 0.12;
          const revealOp = baseOp + 0.88 * beam;
          const sz = 48, breathe = 1 + 0.03 * Math.sin(elapsed * 1.2 + i), s = sz * breathe;

          return (
            <g key={i}>
              <line x1={fpx} y1={fpy} x2={CX} y2={CY} stroke={m.color} strokeOpacity={0.03 + 0.05 * beam} strokeWidth={0.4} strokeDasharray="3 5" />
              {beam > 0.3 && <circle cx={fpx} cy={fpy} r={s * 0.9} fill={m.color} opacity={0.08 * beam} filter="url(#sgl2q)" />}
              <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={6} fill={COLORS.bgPrimary} stroke={m.color} strokeWidth={inBeam ? 1.2 : 0.6} strokeOpacity={baseOp + 0.5 * beam} opacity={revealOp} />
              <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={6} fill={m.color} opacity={0.04 + 0.08 * beam} />
              <text x={fpx} y={fpy + 2} fill={m.color} fontSize={16} fontWeight={600} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" dominantBaseline="middle" opacity={0.08 + 0.92 * beam} letterSpacing={1}>{m.label}</text>
              <text x={fpx} y={fpy + s / 2 + 14} fill={m.color} fontSize={8} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" letterSpacing={1.2} opacity={0.05 + 0.65 * beam}>{m.name.toUpperCase()}</text>
              <circle cx={fpx + s / 2 - 6} cy={fpy - s / 2 + 6} r={2.5} fill={m.color} opacity={0.1 + 0.7 * beam} />
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={5 * pulseScale} fill={COLORS.ambar} filter="url(#gl2q)" opacity={0.8} />
        <circle cx={CX} cy={CY} r={3} fill={COLORS.ambarLight} />
        <circle cx={CX} cy={CY} r={1.5} fill="white" opacity={0.5} />

        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180, major = i % 18 === 0, minor = i % 9 === 0;
          const inn = major ? 355 : minor ? 360 : 365;
          return <line key={`t${i}`} x1={CX + inn * Math.cos(a)} y1={CY + inn * Math.sin(a)} x2={CX + 370 * Math.cos(a)} y2={CY + 370 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={major ? 0.15 : minor ? 0.08 : 0.04} strokeWidth={major ? 0.8 : 0.4} />;
        })}

        {[{ l: "N", a: -90 }, { l: "S", a: 90 }, { l: "E", a: 0 }, { l: "W", a: 180 }].map(({ l, a }) => {
          const rad = (a * Math.PI) / 180;
          return <text key={l} x={CX + 385 * Math.cos(rad)} y={CY + 385 * Math.sin(rad) + 3} fill={COLORS.ambar} fillOpacity={0.1} fontSize={8} fontFamily="monospace" textAnchor="middle" letterSpacing={2}>{l}</text>;
        })}

        <text x={W - 20} y={H - 15} fill={COLORS.ambar} fillOpacity={0.15} fontSize={10} fontFamily="monospace" textAnchor="end" letterSpacing={4}>TERRADAR</text>
      </svg>

      {/* Top indicator */}
      <div style={{ position: "absolute", top: 20, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS.ambar, boxShadow: `0 0 8px ${COLORS.ambar}` }} />
          <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Mapeamento de substâncias</span>
        </div>
        <span style={{ fontSize: 10, letterSpacing: 1.5, color: COLORS.ambar, opacity: 0.35, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
          {Math.floor(sweepAngle).toString().padStart(3, "0")}°
        </span>
      </div>

      {/* Bottom counter */}
      <div style={{ position: "absolute", bottom: 20, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary, marginBottom: 6, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Substâncias identificadas</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {MINERALS.map((m, i) => {
              const mAngle = angleBetween(CX, CY, CX + m.x, CY + m.y);
              const mDiff = Math.abs(angleDiff(sweepAngle, mAngle));
              const lit = mDiff < 50;
              return <div key={i} style={{ width: 7, height: 7, borderRadius: 2, background: lit ? m.color : COLORS.border, transition: "background 0.3s ease", opacity: lit ? 1 : 0.2 }} />;
            })}
            <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.ambar, marginLeft: 4, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
              {MINERALS.filter(m => { const a = angleBetween(CX, CY, CX + m.x, CY + m.y); return Math.abs(angleDiff(sweepAngle, a)) < 50; }).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
