import { useEffect, useRef, useState } from "react";
import { RacingHUD } from "./RacingHUD";

export function RacingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);

  // Client-only mount gate to prevent SSR hydration mismatch (React #418).
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !canvasRef.current) return;
    let disposed = false;
    let gameInstance: { dispose: () => void } | null = null;

    // Dynamic import keeps Three.js / cannon-es out of the SSR bundle.
    import("@/game/Game").then(({ Game }) => {
      if (disposed || !canvasRef.current) return;
      const game = new Game(canvasRef.current);
      game.start();
      gameInstance = game;
    });

    return () => {
      disposed = true;
      gameInstance?.dispose();
    };
  }, [mounted]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <canvas ref={canvasRef} className="block h-full w-full" />
      {mounted && <RacingHUD />}
    </div>
  );
}
