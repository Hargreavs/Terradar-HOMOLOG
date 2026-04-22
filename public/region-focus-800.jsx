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

const MAP_VB = { x: 181.79, y: 267.85, w: 68.46, h: 71.58 };
const MAP_CX = MAP_VB.x + MAP_VB.w / 2;
const MAP_CY = MAP_VB.y + MAP_VB.h / 2;

const REGIONS = [
  { name: "Norte", label: "N", color: "#35B88A", cx: 207.586, cy: 286.595 },
  { name: "Nordeste", label: "NE", color: "#D4A843", cx: 235.475, cy: 295.259 },
  { name: "Centro-Oeste", label: "CO", color: "#9BB8D0", cx: 216.918, cy: 304.85 },
  { name: "Sudeste", label: "SE", color: "#C87C5B", cx: 228.361, cy: 311.324 },
  { name: "Sul", label: "S", color: "#8FAA8D", cx: 218.406, cy: 325.565 },
];

const W = 800;
const H = 800;
const CX = 400;
const CY = 400;
const RADII_BG = [80, 160, 240, 320];
const MAP_SCALE = 280 / MAP_VB.w;

function angleBetween(cx, cy, px, py) {
  return Math.atan2(py - cy, px - cx) * 180 / Math.PI;
}
function angleDiff(a, b) {
  let d = ((b - a + 180) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

export default function RegionFocus800() {
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

  const sonarFade = Math.max(0, 1 - elapsed / 2);
  const mapDrawProgress = Math.min(1, Math.max(0, (elapsed - 0.5) / 2));
  const mapDrawEased = mapDrawProgress * mapDrawProgress * (3 - 2 * mapDrawProgress);
  const regionsProgress = Math.min(1, Math.max(0, (elapsed - 2.5) / 1));
  const sweepActive = elapsed > 3;
  const sweepOpacity = sweepActive ? Math.min(1, (elapsed - 3) / 1) : 0;
  const sweep = (elapsed * 50) % 360;
  const pulse = 1 + 0.15 * Math.abs(Math.sin(elapsed * Math.PI * 0.4));

  const mapToCanvas = (mx, my) => ({
    x: CX + (mx - MAP_CX) * MAP_SCALE,
    y: CY + (my - MAP_CY) * MAP_SCALE,
  });

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100vh", background: COLORS.bgPrimary, position: "relative", overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="cg4q" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.05" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="swG4q" cx="0" cy="0" r="1">
            <stop offset="0%" stopColor={COLORS.ambar} stopOpacity="0.15" />
            <stop offset="60%" stopColor={COLORS.ambar} stopOpacity="0.04" />
            <stop offset="100%" stopColor={COLORS.ambar} stopOpacity="0" />
          </radialGradient>
          <mask id="swM4q">
            <rect width={W} height={H} fill="black" />
            {(() => {
              const a1 = ((sweep - 40) * Math.PI) / 180, a2 = ((sweep + 40) * Math.PI) / 180, r = 380;
              return <path d={`M ${CX} ${CY} L ${CX + r * Math.cos(a1)} ${CY + r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(a2)} ${CY + r * Math.sin(a2)} Z`} fill="white" />;
            })()}
          </mask>
          <filter id="gl4q"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          <filter id="rgG4q"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>

        <circle cx={CX} cy={CY} r={300} fill="url(#cg4q)" />

        {Array.from({ length: Math.ceil(H / 45) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 45} x2={W} y2={i * 45} stroke={COLORS.ambar} strokeOpacity={0.025} strokeWidth={0.5} />)}
        {Array.from({ length: Math.ceil(W / 45) + 1 }, (_, i) => <line key={`v${i}`} x1={i * 45} y1={0} x2={i * 45} y2={H} stroke={COLORS.ambar} strokeOpacity={0.025} strokeWidth={0.5} />)}

        {RADII_BG.map(r => <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={COLORS.ambar} strokeOpacity={0.04} strokeWidth={0.5} strokeDasharray="3 6" />)}

        <line x1={CX} y1={CY - 370} x2={CX} y2={CY + 370} stroke={COLORS.ambar} strokeOpacity={0.03} strokeWidth={0.5} />
        <line x1={CX - 370} y1={CY} x2={CX + 370} y2={CY} stroke={COLORS.ambar} strokeOpacity={0.03} strokeWidth={0.5} />

        {sonarFade > 0.01 && [
          { color: COLORS.verde, baseR: 100, freq: 0.15 },
          { color: COLORS.ambarRisco, baseR: 180, freq: 0.12 },
          { color: COLORS.ambar, baseR: 260, freq: 0.09 },
        ].map((dim, di) => [0, 1].map(wi => {
          const phase = (elapsed * dim.freq + wi * 0.5) % 1;
          const radius = dim.baseR * 0.2 + phase * dim.baseR;
          return <circle key={`sw${di}${wi}`} cx={CX} cy={CY} r={radius} fill="none" stroke={dim.color} strokeOpacity={0.15 * (1 - phase * 0.8) * sonarFade} strokeWidth={1.5 * (1 - phase * 0.5)} />;
        }))}

        {sweepActive && (
          <g opacity={sweepOpacity * 0.7}>
            <circle cx={CX} cy={CY} r={360} fill="url(#swG4q)" mask="url(#swM4q)" />
            {(() => { const a = ((sweep + 40) * Math.PI) / 180; return <line x1={CX} y1={CY} x2={CX + 360 * Math.cos(a)} y2={CY + 360 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={0.2} strokeWidth={0.6} />; })()}
          </g>
        )}

        <g transform={`translate(${CX}, ${CY}) scale(${MAP_SCALE}) translate(${-MAP_CX}, ${-MAP_CY})`} opacity={mapDrawEased}>
          <rect x={MAP_VB.x} y={MAP_VB.y} width={MAP_VB.w} height={MAP_VB.h} fill="none" stroke={COLORS.ambar} strokeWidth={0.3} strokeOpacity={0.1} strokeDasharray="1 2" />

          {REGIONS.map((r, i) => {
            const regionDelay = i * 0.2;
            const regionAppear = Math.min(1, Math.max(0, (regionsProgress - regionDelay) / 0.5));
            const canvasPos = mapToCanvas(r.cx, r.cy);
            const regionAngle = angleBetween(CX, CY, canvasPos.x, canvasPos.y);
            const diff = Math.abs(angleDiff(sweep, regionAngle));
            const inBeam = sweepActive && diff < 60;
            const beam = inBeam ? Math.max(0, 1 - diff / 60) : 0;

            return (
              <g key={i} opacity={regionAppear}>
                <circle cx={r.cx} cy={r.cy} r={1.5 + beam} fill={r.color} opacity={0.15 + 0.6 * beam} filter={beam > 0.3 ? "url(#rgG4q)" : undefined} />
                <text x={r.cx} y={r.cy + 4} fill={r.color} fontSize={2.8} fontWeight={600} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" letterSpacing={0.5} opacity={0.06 + 0.55 * beam}>{r.label}</text>
                {beam > 0.2 && (
                  <text x={r.cx} y={r.cy - 3.5} fill={r.color} fontSize={1.8} fontFamily="'Helvetica Neue', Arial" textAnchor="middle" letterSpacing={0.3} opacity={0.4 * beam}>{r.name.toUpperCase()}</text>
                )}
              </g>
            );
          })}
        </g>

        {(() => {
          const rp = (elapsed * 0.3) % 1;
          return <circle cx={CX} cy={CY} r={8 * (1 + rp * 5)} fill="none" stroke={COLORS.ambar} strokeOpacity={0.12 * (1 - rp)} strokeWidth={0.5} />;
        })()}

        <circle cx={CX} cy={CY} r={5 * pulse} fill={COLORS.ambar} filter="url(#gl4q)" opacity={0.6} />
        <circle cx={CX} cy={CY} r={3} fill={COLORS.ambarLight} />
        <circle cx={CX} cy={CY} r={1.5} fill="white" opacity={0.5} />

        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * 5 * Math.PI) / 180, major = i % 18 === 0;
          const inn = major ? 345 : 355;
          return <line key={`t${i}`} x1={CX + inn * Math.cos(a)} y1={CY + inn * Math.sin(a)} x2={CX + 360 * Math.cos(a)} y2={CY + 360 * Math.sin(a)} stroke={COLORS.ambar} strokeOpacity={major ? 0.1 : 0.03} strokeWidth={major ? 0.6 : 0.3} />;
        })}

        <text x={W - 20} y={H - 15} fill={COLORS.ambar} fillOpacity={0.15} fontSize={10} fontFamily="monospace" textAnchor="end" letterSpacing={4}>TERRADAR</text>
      </svg>

      {/* Top indicator */}
      <div style={{ position: "absolute", top: 20, left: 24, right: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: COLORS.ambar, boxShadow: `0 0 10px ${COLORS.ambar}` }} />
          <span style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Foco geográfico</span>
        </div>
        <span style={{ fontSize: 10, letterSpacing: 1.5, color: COLORS.ambar, opacity: 0.3, fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
          {sweepActive ? `${Math.floor(sweep).toString().padStart(3, "0")}°` : "---°"}
        </span>
      </div>

      {/* Bottom - region legend */}
      <div style={{ position: "absolute", bottom: 20, left: 24, right: 24, opacity: regionsProgress }}>
        <div style={{ fontSize: 9, letterSpacing: 2.5, textTransform: "uppercase", color: COLORS.textSecondary, marginBottom: 10, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>Regiões disponíveis</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          {REGIONS.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: 2, background: r.color, opacity: 0.6 }} />
              <span style={{ fontSize: 10, color: r.color, opacity: 0.5, letterSpacing: 1, fontWeight: 500, fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>{r.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
