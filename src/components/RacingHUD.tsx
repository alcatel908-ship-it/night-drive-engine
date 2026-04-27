import { useGameState } from "@/game/GameState";

export function RacingHUD() {
  const speed = useGameState((s) => s.speedKmh);
  const nitro = useGameState((s) => s.nitro);
  const nitroActive = useGameState((s) => s.nitroActive);
  const gear = useGameState((s) => s.gear);
  const rpm = useGameState((s) => s.rpm);
  const grounded = useGameState((s) => s.grounded);
  const drifting = useGameState((s) => s.drifting);

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-mono">
      {/* Top-left brand */}
      <div className="absolute left-6 top-6 text-xs uppercase tracking-[0.4em] text-[color:var(--neon-cyan)]"
           style={{ textShadow: "0 0 8px var(--neon-cyan)" }}>
        ◢ NEON STREET RACER
      </div>

      {/* Controls hint */}
      <div className="absolute right-6 top-6 rounded-md border px-3 py-2 text-[10px] uppercase tracking-widest"
           style={{
             background: "var(--hud-bg)",
             borderColor: "var(--hud-border)",
             color: "var(--neon-cyan)",
             backdropFilter: "blur(10px)",
           }}>
        WASD drive · SHIFT nitro · SPACE drift · B brake · R reset
      </div>

      {/* Debug telemetry */}
      <div
        className="absolute left-6 bottom-6 rounded-md border px-3 py-2 text-[10px] uppercase tracking-widest leading-relaxed"
        style={{
          background: "var(--hud-bg)",
          borderColor: "var(--hud-border)",
          color: "var(--neon-cyan)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div>SPD <span className="text-[color:var(--neon-yellow)] tabular-nums">{Math.round(speed)}</span> km/h</div>
        <div>GEAR <span className="text-[color:var(--neon-yellow)]">{gear}</span></div>
        <div>
          GROUND{" "}
          <span style={{ color: grounded ? "var(--neon-cyan)" : "var(--neon-pink)" }}>
            {grounded ? "YES" : "NO"}
          </span>
        </div>
        <div>
          DRIFT{" "}
          <span style={{ color: drifting ? "var(--neon-pink)" : "var(--neon-cyan)" }}>
            {drifting ? "ON" : "OFF"}
          </span>
        </div>
      </div>

      {/* Speedometer */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-end gap-8">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--neon-cyan)]/80">Gear</div>
          <div className="text-5xl font-black text-[color:var(--neon-yellow)]"
               style={{ textShadow: "0 0 18px var(--neon-yellow)" }}>{gear}</div>
        </div>

        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--neon-cyan)]/80">km/h</div>
          <div className="text-7xl font-black tabular-nums text-[color:var(--neon-cyan)]"
               style={{ textShadow: "0 0 28px var(--neon-cyan)" }}>
            {Math.round(speed).toString().padStart(3, "0")}
          </div>
          <div className="mt-1 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full transition-[width] duration-100"
                 style={{
                   width: `${Math.min(100, (rpm / 9000) * 100)}%`,
                   background: "linear-gradient(90deg, var(--neon-cyan), var(--neon-pink))",
                   boxShadow: "var(--shadow-neon-pink)",
                 }} />
          </div>
        </div>

        <div className="text-center">
          <div className="text-[10px] uppercase tracking-[0.4em] text-[color:var(--neon-cyan)]/80">
            Nitro {nitroActive && <span className="text-[color:var(--neon-pink)]">ACTIVE</span>}
          </div>
          <div className="mt-2 h-24 w-3 overflow-hidden rounded-full bg-white/10">
            <div className="absolute bottom-0 w-3 rounded-full transition-[height] duration-100"
                 style={{
                   height: `${nitro}%`,
                   background: nitroActive
                     ? "linear-gradient(0deg, var(--neon-pink), var(--neon-yellow))"
                     : "linear-gradient(0deg, var(--neon-violet), var(--neon-cyan))",
                   boxShadow: nitroActive ? "var(--shadow-neon-pink)" : "var(--shadow-neon-cyan)",
                 }} />
          </div>
          <div className="mt-1 text-xs font-bold text-[color:var(--neon-pink)]">
            {Math.round(nitro)}%
          </div>
        </div>
      </div>

      {/* Nitro vignette */}
      {nitroActive && (
        <div className="absolute inset-0 animate-pulse"
             style={{
               boxShadow: "inset 0 0 220px 40px oklch(0.72 0.27 350 / 0.55)",
             }} />
      )}
    </div>
  );
}
