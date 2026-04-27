// Centralized vehicle tuning. Swap entire profiles to change car feel
// without touching VehicleController logic.

export type GearRatio = {
  /** Top speed (km/h) at which the box upshifts out of this gear. */
  maxSpeed: number;
  /** Engine force multiplier — higher in low gears for torque. */
  forceMultiplier: number;
};

export type VehicleConfig = {
  /** Chassis mass (kg) */
  mass: number;
  /** Max engine drive force (N) */
  engineForce: number;
  /** Max brake force per wheel */
  brakingForce: number;
  /** Max steering angle (radians) at standstill */
  maxSteering: number;
  /** Steering reduction at top speed: minSteerFactor in [0..1] */
  minSteerFactor: number;
  /** Speed (km/h) at which steering reaches its minimum */
  steerSpeedReference: number;
  /** Friction slip values for wheels */
  baseGrip: number;
  driftFriction: number;
  frontGripDriftAssist: number;
  frontGripStabilityAssist: number;
  /** Engine multiplier when nitro is active */
  nitroMultiplier: number;
  /** Multiplier applied briefly after exiting a drift */
  driftExitBoost: number;
  /** Velocity alignment strength (per second). */
  velocityAlignment: number;
  /** Aerodynamic drag coefficient (force = -coeff * v * |v|) */
  dragCoefficient: number;
  /** Constant downforce applied per frame */
  baseDownforce: number;
  /** Speed-squared downforce multiplier */
  speedDownforce: number;
  /** Transmission */
  transmissionType: "auto" | "manual";
  /** Seconds the clutch cuts power during a shift. */
  shiftDelay: number;
  /** Forward impulse (N·s) injected right after a shift completes. */
  shiftKickImpulse: number;
  /** 6-speed gear ratios. Indexed 0..5 = gears 1..6. */
  gearRatios: GearRatio[];
};

/** Default "balanced grip" profile used by the game. */
export const VEHICLE_CONFIG: VehicleConfig = {
  mass: 850,
  engineForce: 1800,
  brakingForce: 60,
  maxSteering: 0.55,
  minSteerFactor: 0.45,
  steerSpeedReference: 320,
  baseGrip: 10.5,
  driftFriction: 4.2,
  frontGripDriftAssist: 13.5,
  frontGripStabilityAssist: 16.5,
  nitroMultiplier: 2.1,
  driftExitBoost: 1.2,
  velocityAlignment: 3.2,
  dragCoefficient: 0.55,
  baseDownforce: 2000,
  speedDownforce: 10,
  transmissionType: "auto",
  shiftDelay: 0.1,
  shiftKickImpulse: 1800,
  // Torque is highest in 1st/2nd, tapers off in higher gears.
  gearRatios: [
    { maxSpeed: 40, forceMultiplier: 1.6 },  // 1st
    { maxSpeed: 80, forceMultiplier: 1.35 }, // 2nd
    { maxSpeed: 130, forceMultiplier: 1.1 }, // 3rd
    { maxSpeed: 180, forceMultiplier: 0.9 }, // 4th
    { maxSpeed: 230, forceMultiplier: 0.75 }, // 5th
    { maxSpeed: 300, forceMultiplier: 0.6 }, // 6th
  ],
};

/** Alternate profile — looser rear, lighter, more drifty. */
export const DRIFT_CAR_CONFIG: VehicleConfig = {
  ...VEHICLE_CONFIG,
  mass: 780,
  engineForce: 1700,
  driftFriction: 3.0,
  velocityAlignment: 1.6,
  nitroMultiplier: 2.3,
};
