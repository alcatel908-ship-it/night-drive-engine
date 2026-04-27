import { create } from "zustand";

export type GameStateData = {
  speedKmh: number;
  nitro: number; // 0..100
  nitroActive: boolean;
  gear: number;
  rpm: number;
  /** Telemetry: at least one wheel currently in ground contact. */
  grounded: boolean;
  /** Telemetry: drift active flag. */
  drifting: boolean;
  setSpeed: (v: number) => void;
  setNitro: (v: number) => void;
  setNitroActive: (v: boolean) => void;
  setGear: (v: number) => void;
  setRpm: (v: number) => void;
  setGrounded: (v: boolean) => void;
  setDrifting: (v: boolean) => void;
};

export const useGameState = create<GameStateData>((set) => ({
  speedKmh: 0,
  nitro: 100,
  nitroActive: false,
  gear: 1,
  rpm: 0,
  grounded: true,
  drifting: false,
  setSpeed: (speedKmh) => set({ speedKmh }),
  setNitro: (nitro) => set({ nitro }),
  setNitroActive: (nitroActive) => set({ nitroActive }),
  setGear: (gear) => set({ gear }),
  setRpm: (rpm) => set({ rpm }),
  setGrounded: (grounded) => set({ grounded }),
  setDrifting: (drifting) => set({ drifting }),
}));
