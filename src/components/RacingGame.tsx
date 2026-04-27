import { useEffect, useRef } from "react";
import { Game } from "@/game/Game";
import { RacingHUD } from "./RacingHUD";

export function RacingGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new Game(canvasRef.current);
    game.start();
    return () => game.dispose();
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background">
      <canvas ref={canvasRef} className="block h-full w-full" />
      <RacingHUD />
    </div>
  );
}
