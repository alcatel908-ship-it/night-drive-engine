import { createFileRoute } from "@tanstack/react-router";
import { RacingGame } from "@/components/RacingGame";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Neon Street Racer — High-Performance Web Racing" },
      {
        name: "description",
        content:
          "A neon-soaked 3D street racer built with Three.js and cannon-es physics. WASD to drive, SHIFT for nitro.",
      },
      { property: "og:title", content: "Neon Street Racer" },
      {
        property: "og:description",
        content: "Drift through a neon city in this Three.js + cannon-es racing engine.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <RacingGame />;
}
