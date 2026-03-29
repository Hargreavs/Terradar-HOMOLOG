import { useState, useEffect, useRef } from "react";

const COLORS = {
  ambar: "#EF9F27",
  ambarLight: "#F1B85A",
  verde: "#1D9E75",
  ambarRisco: "#E8A830",
  textPrimary: "#F1EFE8",
  textSecondary: "#888780",
  bgPrimary: "#0D0D0C",
  border: "#2C2C2A",
};

const DIMENSIONS = [
  { label: "Segurança", color: COLORS.verde, baseRadius: 100, freq: 0.15 },
  { label: "Viabilidade", color: COLORS.ambarRisco, baseRadius: 180, freq: 0.12 },
  { label: "Atratividade", color: COLORS.ambar, baseRadius: 260, freq: 0.09 },
];

const PROFILES = [
  { name: "Conservador", weights: [45, 30, 25], duration: 5 },
  { name: "Moderado", weights: [30, 30, 40], duration: 5 },
  { name: "Arrojado", weights: [20, 25, 55], duration: 5 },
];

const MINERALS = [
  { label: "Fe", color: "#7EADD4", x: 100, y: -160 },
  { label: "Cu", color: "#C87C5B", x: -80, y: -110 },
  { label: "Au", color: "#D4A843", x: 166, y: 72 },
  { label: "Nb", color: "#5CBFA0", x: -137, y: 144 },
  { label: "TR", color: "#3D8B7A", x: 58, y: 230 },
  { label: "Li", color: "#9BB8D0", x: -173, y: -58 },
  { label: "Ni", color: "#8FAA8D", x: 122, y: -252 },
  { label: "Bx", color: "#B8917A", x: -43, y: 288 },
  { label: "Qz", color: "#C4B89A", x: 144, y: -36 },
];

const W = 800;
const H = 800;
const CX = 400;
const CY = 400;
const RADII_BG = [80, 160, 240, 320];

function lerp(a, b, t) { return a + (b - a) * t; }

function getProfile(elapsed) {
  const totalCycle = PROFILES.reduce((s, p) => s + p.duration, 0);
  const t = elapsed % totalCycle;
  let acc = 0;
  for (let i = 0; i < PROFILES.length; i++) {
    if (t < acc + PROFILES[i].duration) {
      const progress = (t - acc) / PROFILES[i].duration;
      const next = PROFILES[(i + 1) % PROFILES.length];
      const blend = progress < 0.4 ? 0 : progress > 0.8 ? 1 : (progress - 0.4) / 0.4;
      const eased = blend * blend * (3 - 2 * blend);
      return {
        name: blend < 0.5 ? PROFILES[i].name : next.name,
        weights: PROFILES[i].weights.map((w, j) => lerp(w, next.weights[j], eased)),
        dominantColor: blend < 0.5
          ? (PROFILES[i].weights[0] > 35 ? COLORS.verde : PROFILES[i].weights[2] > 40 ? COLORS.ambar : COLORS.ambarRisco)
          : (next.weights[0] > 35 ? COLORS.verde : next.weights[2] > 40 ? COLORS.ambar : COLORS.ambarRisco),
      };
    }
    acc += PROFILES[i].duration;
  }
  return { name: PROFILES[0].name, weights: PROFILES[0].weights, dominantColor: COLORS.verde };
}

export default function RiskCalibration800() {
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

  const profile = getProfile(elapsed);
  const pulseScale = 1 + 0.2 * Math.abs(Math.sin(elapsed * Math.PI * 0.4));

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: COLORS.bgPrimary, position: "relative", overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="cg3q" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.05" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <filter id="gl3q"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="rgq"><feGaussianBlur stdDeviation="8" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <circle cx={CX} cy={CY} r={300} fill="url(#cg3q)" />

        {Array.from({ length: Math.ceil(H / 45) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 45} x2={W} y2={i * 45} stroke={COLORS.ambar} strokeOpacity={0.025} strokeWidth={0.5} />)}
        {Array.from({ length: Math.ceil(W / 45) + 1 }, (_, i) => <line key={`v${i}`} x1={i * 45} y1={0} x2={i * 45} y2={H} stroke={COLORS.ambar} strokeOpacity={0.025} strokeWidth={0.5} />)}

        {RADII_BG.map(r => <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} strokeDasharray="3 6" />)}

        <line x1={CX} y1={CY - 370} x2={CX} y2={CY + 370} stroke={COLORS.ambar} strokeOpacity={0.03} strokeWidth={0.5} />
        <line x1={CX - 370} y1={CY} x2={CX + 370} y2={CY} stroke={COLORS.ambar} strokeOpacity={0.03} strokeWidth={0.5} />

        {DIMENSIONS.map((dim, di) => {
          const weight = profile.weights[di] / 100;
          const thickness = 1.5 + weight * 5;
          const opacity = 0.05 + weight * 0.28;
          return [0, 1].map(w => {
            const phase = (elapsed * dim.freq + w * 0.5) % 1;
            const radius = dim.baseRadius * 0.2 + phase * dim.baseRadius;
            const waveOpacity = opacity * (1 - phase * 0.8) * (0.4 + weight * 0.6);
            return <circle key={`w${di}${w}`} cx={CX} cy={CY} r={radius} fill="none" stroke={dim.color} strokeOpacity={waveOpacity} strokeWidth={thickness * (1 - phase * 0.5)} filter={weight > 0.35 ? "url(#rgq)" : undefined} />;
          });
        })}

        {DIMENSIONS.map((dim, di) => {
          const weight = profile.weights[di] / 100;
          return <circle key={`o${di}`} cx={CX} cy={CY} r={dim.baseRadius} fill="none" stroke={dim.color} strokeOpacity={0.06 + weight * 0.15} strokeWidth={0.8 + weight * 1.5} strokeDasharray="1 4" style={{ transition: "stroke-opacity 0.8s ease, stroke-width 0.8s ease" }} />;
        })}

        {MINERALS.map((m, i) => {
          const floatY = Math.sin(elapsed * 0.25 + i * 0.9) * 4;
          const floatX = Math.cos(elapsed * 0.2 + i * 0.7) * 3;
          const fpx = CX + m.x + floatX, fpy = CY + m.y + floatY;
          const sz = 40, breathe = 1 + 0.02 * Math.sin(elapsed * 0.8 + i), s = sz * breathe;
          const dist = Math.sqrt(m.x ** 2 + m.y ** 2);
          let cd = 0, cdist = 1e9;
          DIMENSIONS.forEach((d, di) => { const dd = Math.abs(dist - d.baseRadius); if (dd < cdist) { cdist = dd; cd = di; } });
          const dw = profile.weights[cd] / 100;
          const cardOp = 0.12 + dw * 0.3;
          return (
            <g key={`m${i}`} opacity={cardOp} style={{ transition: "opacity 1s ease" }}>
              <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={5} fill={COLORS.bgPrimary} stroke={m.color} strokeWidth={0.6} strokeOpacity={0.25 + dw * 0.35} />
              <rect x={fpx - s / 2} y={fpy - s / 2} width={s} height={s} rx={5} fill={m.color} opacity={0.03 + dw * 0.07} />
              <text x={fpx} y={fpy + 2} fill={m.color} fontSize={14} fontWeight={500} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" dominantBaseline="middle" opacity={0.4 + dw * 0.5} letterSpacing={0.5}>{m.label}</text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r={6 * pulseScale} fill={profile.dominantColor} filter="url(#gl3q)" opacity={0.6} style={{ transition: "fill 1s ease" }} />
        <circle cx={CX} cy={CY} r={3.5} fill={COLORS.ambarLight} />
        <circle cx={CX} cy={CY} r={1.5} fill="white" opacity={0.5} />

        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180, major = i % 18 === 0;
          const inn = major ? 345 : 355;
          return <line key={`t${i}`} x1={CX + inn * Math.cos(a)} y1={CY + inn * Math.sin(a)} x2={CX + 360 * Math.cos(a)} y2={CY + 360 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={major ? 0.12 : 0.04} strokeWidth={major ? 0.7 : 0.3} />;
        })}

        <text x={W - 20} y={H - 15} fill={COLORS.ambar} fillOpacity={0.15} fontSize={10} fontFamily="monospace" textAnchor="end" letterSpacing={4}>TERRADAR</text>
      </svg>

      {/* Top - profile indicator */}
      <div style={{ position: "absolute", top: 20, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: profile.dominantColor, boxShadow: `0 0 10px ${profile.dominantColor}`, transition: "background 1s ease, box-shadow 1s ease" }} />
          <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Perfil de risco</span>
        </div>
        <span style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", fontWeight: 600, color: profile.dominantColor, opacity: 0.7, fontFamily: "'Helvetica Neue', Arial, sans-serif", transition: "color 1s ease" }}>
          {profile.name}
        </span>
      </div>

      {/* Bottom - proportion bars */}
      <div style={{ position: "absolute", bottom: 20, left: 24, right: 24 }}>
        <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary, marginBottom: 12, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Pesos do Opportunity Score</div>
        {DIMENSIONS.map((dim, di) => {
          const weight = profile.weights[di];
          return (
            <div key={di} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: dim.color, opacity: 0.5 + (weight / 100) * 0.5, width: 85, textAlign: "right", fontFamily: "'Helvetica Neue', Arial, sans-serif", fontWeight: 500, transition: "opacity 0.8s ease" }}>{dim.label}</span>
              <div style={{ flex: 1, height: 4, background: COLORS.border, borderRadius: 2, overflow: "hidden" }}>
                <div style={{ height: "100%", borderRadius: 2, background: dim.color, width: `${weight}%`, opacity: 0.45 + (weight / 100) * 0.55, transition: "width 1s ease, opacity 1s ease" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: dim.color, opacity: 0.4 + (weight / 100) * 0.6, width: 32, textAlign: "right", fontVariantNumeric: "tabular-nums", fontFamily: "monospace", transition: "opacity 0.8s ease" }}>{Math.round(weight)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
