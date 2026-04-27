import { create } from "zustand";

export type GameStateData = {
  speedKmh: number;
  nitro: number; // 0..100
  nitroActive: boolean;
  gear: number;
  gearLabel: string; // "R" | "N" | "1".."6"
  rpm: number;
  revLimit: boolean;
  grounded: boolean;
  drifting: boolean;
  setSpeed: (v: number) => void;
  setNitro: (v: number) => void;
  setNitroActive: (v: boolean) => void;
  setGear: (v: number) => void;
  setGearLabel: (v: string) => void;
  setRpm: (v: number) => void;
  setRevLimit: (v: boolean) => void;
  setGrounded: (v: boolean) => void;
  setDrifting: (v: boolean) => void;
};

export const useGameState = create<GameStateData>((set) => ({
  speedKmh: 0,
  nitro: 100,
  nitroActive: false,
  gear: 0,
  gearLabel: "N",
  rpm: 0,
  revLimit: false,
  grounded: true,
  drifting: false,
  setSpeed: (speedKmh) => set({ speedKmh }),
  setNitro: (nitro) => set({ nitro }),
  setNitroActive: (nitroActive) => set({ nitroActive }),
  setGear: (gear) => set({ gear }),
  setGearLabel: (gearLabel) => set({ gearLabel }),
  setRpm: (rpm) => set({ rpm }),
  setRevLimit: (revLimit) => set({ revLimit }),
  setGrounded: (grounded) => set({ grounded }),
  setDrifting: (drifting) => set({ drifting }),
}));
