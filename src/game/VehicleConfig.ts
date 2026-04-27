// Centralized vehicle tuning. Swap entire profiles to change car feel
// without touching VehicleController logic.

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
  driftFriction: number; // rear wheels while drifting
  frontGripDriftAssist: number;
  frontGripStabilityAssist: number;
  /** Engine multiplier when nitro is active */
  nitroMultiplier: number;
  /** Multiplier applied briefly after exiting a drift */
  driftExitBoost: number;
  /** Velocity alignment strength (per second). Higher = snappier grip */
  velocityAlignment: number;
  /** Aerodynamic drag coefficient (force = -coeff * v * |v|) */
  dragCoefficient: number;
  /** Constant downforce applied per frame */
  baseDownforce: number;
  /** Speed-squared downforce multiplier */
  speedDownforce: number;
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
};

/** Alternate profile — looser rear, lighter, more drifty. Available for swap. */
export const DRIFT_CAR_CONFIG: VehicleConfig = {
  ...VEHICLE_CONFIG,
  mass: 780,
  engineForce: 1700,
  driftFriction: 3.0,
  velocityAlignment: 1.6,
  nitroMultiplier: 2.3,
};
