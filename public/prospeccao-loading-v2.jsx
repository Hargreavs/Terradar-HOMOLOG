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
  { label: "Fe", color: "#7EADD4", x: -500, y: -200 },
  { label: "Cu", color: "#C87C5B", x: 450, y: -250 },
  { label: "Au", color: "#D4A843", x: -320, y: 220 },
  { label: "Nb", color: "#5CBFA0", x: 520, y: 150 },
  { label: "TR", color: "#3D8B7A", x: -180, y: -300 },
  { label: "Li", color: "#9BB8D0", x: 350, y: 280 },
  { label: "Ni", color: "#8FAA8D", x: -450, y: 80 },
  { label: "Bx", color: "#B8917A", x: 200, y: -280 },
  { label: "Qz", color: "#C4B89A", x: -80, y: 300 },
];

const W = 1400;
const H = 800;
const CX = W / 2;
const CY = H / 2;
const RADII = [60, 120, 180, 240, 300, 380];
const ABSORB_START = 2;
const ABSORB_STAGGER = 0.35;
const CYCLE = 8;

function clamp(v) { return Math.max(0, Math.min(1, v)); }
function easeIn(t) { return t * t * t; }

export default function ProspeccaoLoadingV2() {
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

  const cycleT = elapsed % CYCLE;
  const speedBoost = cycleT < ABSORB_START ? 0 : Math.min(1, (cycleT - ABSORB_START) / 4);
  const sweep = (elapsed * 80 + speedBoost * elapsed * 40) % 360;
  const pulse = 1 + 0.25 * Math.abs(Math.sin(elapsed * Math.PI * 0.5));
  const rp1 = (elapsed * 0.4) % 1;
  const rp2 = ((elapsed + 1.0) * 0.4) % 1;

  const absorbedCount = MINERALS.filter((_, i) => cycleT > ABSORB_START + i * ABSORB_STAGGER + 0.6).length;
  const centerEnergy = absorbedCount / MINERALS.length;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: 500, background: COLORS.bgPrimary, position: "relative", overflow: "hidden", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="swpL2" cx="0" cy="0" r="1">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.35" />
            <stop offset="60%" stopColor={COLORS.ambar} stopOpacity="0.08" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ctrL2" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity={0.06 + centerEnergy * 0.12} />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <mask id="smL2">
            <rect width={W} height={H} fill="black" />
            {(() => {
              const a1 = ((sweep - 35) * Math.PI) / 180, a2 = ((sweep + 35) * Math.PI) / 180, r = 450;
              return <path d={`M ${CX} ${CY} L ${CX + r * Math.cos(a1)} ${CY + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(a2)} ${CY + r * Math.sin(a2)} Z`} fill="white" />;
            })()}
          </mask>
          <filter id="glL2"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="sglL2"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        {/* Ambient center glow */}
        <circle cx={CX} cy={CY} r={300 + centerEnergy * 50} fill="url(#ctrL2)" />

        {/* Grid */}
        {Array.from({ length: Math.ceil(H / 50) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 50} x2={W} y2={i * 50} stroke={COLORS.ambar} strokeOpacity={0.05} strokeWidth={0.5} />)}
        {Array.from({ length: Math.ceil(W / 50) + 1 }, (_, i) => <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={H} stroke={COLORS.ambar} strokeOpacity={0.05} strokeWidth={0.5} />)}

        {/* Concentric circles */}
        {RADII.map(r => <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={COLORS.ambar} strokeOpacity={0.1} strokeWidth={0.7} strokeDasharray={r > 300 ? "4 6" : "none"} />)}

        {/* Cross hairs */}
        <line x1={CX} y1={0} x2={CX} y2={H} stroke={COLORS.ambar} strokeOpacity={0.07} strokeWidth={0.5} />
        <line x1={0} y1={CY} x2={W} y2={CY} stroke={COLORS.ambar} strokeOpacity={0.07} strokeWidth={0.5} />
        <line x1={CX - 350} y1={CY - 350} x2={CX + 350} y2={CY + 350} stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} />
        <line x1={CX + 350} y1={CY - 350} x2={CX - 350} y2={CY + 350} stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} />

        {/* Sweep */}
        <circle cx={CX} cy={CY} r={420} fill="url(#swpL2)" mask="url(#smL2)" />
        {(() => { const a = ((sweep + 35) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 420 * Math.cos(a)} y2={CY + 420 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.5} strokeWidth={1} />; })()}
        {(() => { const a = ((sweep - 35) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 420 * Math.cos(a)} y2={CY + 420 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.12} strokeWidth={0.5} />; })()}

        {/* Expanding rings */}
        <circle cx={CX} cy={CY} r={8 * (1 + rp1 * 7)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.3 * (1 - rp1)} strokeWidth={0.8} />
        <circle cx={CX} cy={CY} r={8 * (1 + rp2 * 7)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.2 * (1 - rp2)} strokeWidth={0.6} />

        {/* Mineral cards */}
        {MINERALS.map((m, i) => {
          const absorbTime = ABSORB_START + i * ABSORB_STAGGER;
          const absorbProgress = clamp((cycleT - absorbTime) / 0.6);
          const absorbed = absorbProgress >= 1;

          if (absorbed && cycleT > absorbTime + 1) {
            if (cycleT < 1) {
              const reappear = clamp(cycleT / 0.8);
              const fpx = CX + m.x, fpy = CY + m.y, sz = 44;
              return (
                <g key={i} opacity={reappear * 0.45}>
                  <rect x={fpx - sz / 2} y={fpy - sz / 2} width={sz} height={sz} rx={6} fill={COLORS.bgPrimary} stroke={m.color} strokeWidth={0.8} strokeOpacity={0.4} />
                  <rect x={fpx - sz / 2} y={fpy - sz / 2} width={sz} height={sz} rx={6} fill={m.color} opacity={0.06} />
                  <text x={fpx} y={fpy + 2} fill={m.color} fontSize={15} fontWeight={600} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" dominantBaseline="middle" opacity={0.7}>{m.label}</text>
                </g>
              );
            }
            return null;
          }

          const conv = easeIn(absorbProgress);
          const scale = 1 - conv * 0.8;
          const opFactor = 1 - easeIn(absorbProgress);
          const bx = m.x * (1 - conv), by = m.y * (1 - conv);
          const fy = Math.sin(elapsed * 0.25 + i * 0.9) * 4 * (1 - conv);
          const fx = Math.cos(elapsed * 0.2 + i * 0.7) * 3 * (1 - conv);
          const fpx = CX + bx + fx, fpy = CY + by + fy;
          const sz = 44 * Math.max(0.1, scale);
          const s = sz * (1 + 0.02 * Math.sin(elapsed * 0.8 + i));
          const cardOp = 0.45 * opFactor;

          if (cardOp < 0.01 || s < 3) return null;

          return (
            <g key={i}>
              <line x1={fpx} y1={fpy} x2={CX} y2={CY} stroke={m.color} strokeOpacity={0.06 + conv * 0.2} strokeWidth={0.5 + conv * 0.8} strokeDasharray="3 5" />

              {conv > 0.3 && <circle cx={fpx} cy={fpy} r={s * 0.8} fill={m.color} opacity={0.08 * conv} filter="url(#sglL2)" />}

              <g opacity={cardOp}>
                <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={6 * scale} fill={COLORS.bgPrimary} stroke={m.color} strokeWidth={0.8 + conv * 0.5} strokeOpacity={0.5 + conv * 0.4} />
                <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={6 * scale} fill={m.color} opacity={0.06 + conv * 0.12} />
                {s > 15 && (
                  <text x={fpx} y={fpy + 2} fill={m.color} fontSize={15 * scale} fontWeight={600} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" dominantBaseline="middle" opacity={0.7 + conv * 0.3}>{m.label}</text>
                )}
              </g>

              {absorbProgress > 0.8 && absorbProgress < 1 && (
                <circle cx={CX} cy={CY} r={20 + (absorbProgress - 0.8) * 200} fill="none" stroke={m.color} strokeOpacity={0.25 * (1 - (absorbProgress - 0.8) * 5)} strokeWidth={1} />
              )}
            </g>
          );
        })}

        {/* Center pulse */}
        <circle cx={CX} cy={CY} r={(6 + centerEnergy * 4) * pulse} fill={COLORS.ambar} filter="url(#glL2)" opacity={0.7 + centerEnergy * 0.2} />
        <circle cx={CX} cy={CY} r={3.5 + centerEnergy * 1.5} fill={COLORS.ambarLight} />
        <circle cx={CX} cy={CY} r={1.5 + centerEnergy * 0.5} fill="white" opacity={0.6} />

        {/* Clean zone */}
        <circle cx={CX} cy={CY} r={150} fill="none" stroke={COLORS.ambar} strokeOpacity={0.05} strokeWidth={0.4} strokeDasharray="2 6" />

        {/* Distance labels */}
        {RADII.filter(r => r > 100).map(r => <text key={`l${r}`} x={CX + r + 4} y={CY - 4} fill={COLORS.ambar} fillOpacity={0.15} fontSize={7} fontFamily="monospace">{r}km</text>)}

        {/* Angle ticks */}
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180, major = i % 18 === 0, minor = i % 9 === 0;
          const inn = major ? 385 : minor ? 390 : 395;
          return <line key={`t${i}`} x1={CX + inn * Math.cos(a)} y1={CY + inn * Math.sin(a)} x2={CX + 400 * Math.cos(a)} y2={CY + 400 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={major ? 0.25 : minor ? 0.12 : 0.06} strokeWidth={major ? 0.8 : 0.4} />;
        })}

        {/* Cardinals */}
        {[{ l: "N", a: -90 }, { l: "S", a: 90 }, { l: "E", a: 0 }, { l: "W", a: 180 }].map(({ l, a }) => {
          const rad = (a * Math.PI) / 180;
          return <text key={l} x={CX + 415 * Math.cos(rad)} y={CY + 415 * Math.sin(rad) + 3} fill={COLORS.ambar} fillOpacity={0.15} fontSize={9} fontFamily="monospace" textAnchor="middle" letterSpacing={2}>{l}</text>;
        })}

        <text x={W - 25} y={H - 20} fill={COLORS.ambar} fillOpacity={0.2} fontSize={11} fontFamily="monospace" textAnchor="end" letterSpacing={4}>TERRADAR</text>
      </svg>
    </div>
  );
}
