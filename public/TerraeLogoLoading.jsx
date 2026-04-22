import { useState, useEffect, useRef } from "react";

/**
 * TerraeLogo breathing/wave loading animation.
 * 4 bars that do a sequential vertical wave (staggered), like a calm equalizer.
 * Uses the exact Terrae brand gradient colors from the logo.
 *
 * Props:
 *   size?: number (default 48 — total height in px)
 *   speed?: number (default 1 — animation speed multiplier)
 */
export default function TerraeLogoLoading({ size = 48, speed = 1 }) {
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
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
    };
  }, []);

  // 4 bars with Terrae brand colors (top to bottom, light to dark)
  const bars = [
    { color: "#F0B245", gradEnd: "#E8A830" }, // bar 1 — lightest
    { color: "#D4952A", gradEnd: "#C48825" }, // bar 2
    { color: "#B07A1F", gradEnd: "#9A6B1A" }, // bar 3
    { color: "#8B6118", gradEnd: "#705012" }, // bar 4 — darkest
  ];

  const barCount = bars.length;
  const barHeight = size / (barCount * 2 - 1); // bars + gaps
  const barGap = barHeight;
  const barWidth = size * 1.1; // slightly wider than tall, matching logo proportions
  const barRadius = barHeight * 0.2;

  // Wave parameters
  const waveFreq = 1.8 * speed; // cycles per second
  const waveAmplitude = barHeight * 0.15; // subtle bounce (~15% of bar height)
  const staggerDelay = 0.15; // seconds between each bar's wave start

  return (
    <svg
      width={barWidth}
      height={size}
      viewBox={`0 0 ${barWidth} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block" }}
    >
      <defs>
        {bars.map((bar, i) => (
          <linearGradient
            key={`grad-${i}`}
            id={`terraeLoadGrad${i}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor={bar.color} />
            <stop offset="100%" stopColor={bar.gradEnd} />
          </linearGradient>
        ))}
      </defs>

      {bars.map((bar, i) => {
        // Each bar has a staggered phase in the wave
        const phase = elapsed * waveFreq - i * staggerDelay * waveFreq;
        // Smooth sine wave for vertical displacement
        const wave = Math.sin(phase * Math.PI * 2);
        // Ease: more time at rest (bottom), quick bounce up
        const displacement = wave > 0 ? -wave * waveAmplitude : 0;

        // Subtle opacity pulse synced with wave (brighter at peak)
        const opacityBoost = wave > 0 ? wave * 0.15 : 0;
        const opacity = 0.85 + opacityBoost;

        // Subtle scale-x at peak (very slight stretch)
        const scaleX = 1 + (wave > 0 ? wave * 0.02 : 0);

        const baseY = i * (barHeight + barGap);
        const y = baseY + displacement;

        return (
          <rect
            key={i}
            x={(barWidth - barWidth * scaleX) / 2}
            y={y}
            width={barWidth * scaleX}
            height={barHeight}
            rx={barRadius}
            ry={barRadius}
            fill={`url(#terraeLoadGrad${i})`}
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
