// =====================================================================
//  GAME_CONFIG — Master tuning table.
//  Every balancing knob (mass, gear ratios, friction, nitro, drift,
//  traction, downforce, transmission) lives here. Touch this file to
//  rebalance the game without editing physics/controller logic.
// =====================================================================

export type GearRatio = {
  /** Top speed (km/h) at which the box upshifts out of this gear. */
  maxSpeed: number;
  /** Engine torque multiplier — higher in low gears. */
  forceMultiplier: number;
};

export type VehicleConfig = {
  // ---- Mass & engine ----
  mass: number;
  engineForce: number;
  brakingForce: number;

  // ---- Steering ----
  maxSteering: number;
  minSteerFactor: number;
  steerSpeedReference: number;
  /** How fast the wheels recenter when no steer input (per second). */
  steerReturnSpeed: number;
  /** Extra recentering bonus while exiting a drift (self-aligning torque). */
  driftSelfAlignBoost: number;

  // ---- Tire grip ----
  baseGrip: number;
  driftFriction: number;
  frontGripDriftAssist: number;
  frontGripStabilityAssist: number;

  // ---- Power-ups ----
  nitroMultiplier: number;
  driftExitBoost: number;

  // ---- Traction control / handling feel ----
  velocityAlignment: number;
  dragCoefficient: number;
  baseDownforce: number;
  speedDownforce: number;

  // ---- Transmission ----
  transmissionType: "auto" | "manual";
  shiftDelay: number;
  shiftKickImpulse: number;
  /** Idle RPM at standstill */
  idleRpm: number;
  /** RPM ceiling — used for HUD + future engine sound. */
  redlineRpm: number;
  gearRatios: GearRatio[];
};

/** Master config. Tweak here, never inside controllers. */
export const GAME_CONFIG: VehicleConfig = {
  // Mass & engine
  mass: 850,
  engineForce: 2000,      // strong low-gear punch
  brakingForce: 60,

  // Steering
  maxSteering: 0.55,
  minSteerFactor: 0.45,
  steerSpeedReference: 320,
  steerReturnSpeed: 10,
  driftSelfAlignBoost: 1.8,

  // Tire grip
  baseGrip: 11.0,         // bumped — kills "ice skating" feel
  driftFriction: 4.2,
  frontGripDriftAssist: 13.5,
  frontGripStabilityAssist: 16.5,

  // Power-ups
  nitroMultiplier: 2.1,
  driftExitBoost: 1.2,

  // Handling feel
  velocityAlignment: 4.5, // stronger linear-grip pull when not drifting
  dragCoefficient: 0.55,
  baseDownforce: 2000,
  speedDownforce: 10,

  // Transmission
  transmissionType: "auto",
  shiftDelay: 0.1,
  shiftKickImpulse: 1800,
  idleRpm: 900,
  redlineRpm: 8500,
  // Torque curve: hot off the line, cruising at the top end.
  gearRatios: [
    { maxSpeed: 45, forceMultiplier: 1.7 },   // 1st — punchy
    { maxSpeed: 85, forceMultiplier: 1.45 },  // 2nd — pull
    { maxSpeed: 135, forceMultiplier: 1.15 }, // 3rd
    { maxSpeed: 185, forceMultiplier: 0.95 }, // 4th
    { maxSpeed: 235, forceMultiplier: 0.8 },  // 5th
    { maxSpeed: 300, forceMultiplier: 0.65 }, // 6th — momentum
  ],
};

/** Back-compat alias — older imports still work. */
export const VEHICLE_CONFIG = GAME_CONFIG;

/** Alternate profile — looser rear, lighter, more drifty. */
export const DRIFT_CAR_CONFIG: VehicleConfig = {
  ...GAME_CONFIG,
  mass: 780,
  engineForce: 1850,
  driftFriction: 3.0,
  velocityAlignment: 2.2,
  nitroMultiplier: 2.3,
};
