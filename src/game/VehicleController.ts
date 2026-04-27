import * as THREE from "three";
import * as CANNON from "cannon-es";
import type { InputHandler } from "./InputHandler";

export type VehicleTuning = {
  maxEngineForce: number;
  maxBrakeForce: number;
  maxSteer: number;
  nitroMultiplier: number;
};

export class VehicleController {
  vehicle: CANNON.RaycastVehicle;
  chassisBody: CANNON.Body;
  chassisMesh: THREE.Group;
  wheelMeshes: THREE.Mesh[] = [];
  headlightL: THREE.SpotLight;
  headlightR: THREE.SpotLight;
  taillightL: THREE.PointLight;
  taillightR: THREE.PointLight;

  tuning: VehicleTuning = {
    maxEngineForce: 1800,
    maxBrakeForce: 60,
    maxSteer: 0.55,
    nitroMultiplier: 2.1,
  };

  private currentSteer = 0;
  private isDrifting = false;
  private driftTime = 0;
  private exitBoostTime = 0;
  private wasDrifting = false;
  private bodyRoll = 0;
  // Base grip values — referenced by drift logic & counter-steer assist
  private readonly frontGripBase = 10.5;
  private readonly rearGripBase = 10.5;
  // Slip-angle drift: rear grip reduced by ~60%
  private readonly rearGripDrift = 4.2;
  private readonly frontGripDriftAssist = 13.5;
  private readonly frontGripStabilityAssist = 16.5;

  constructor(world: CANNON.World, scene: THREE.Scene, wheelMaterial?: CANNON.Material) {
    // ---- Collision groups: chassis must NOT collide with its own wheels ----
    const GROUP_GROUND = 1;
    const GROUP_CHASSIS = 2;
    const GROUP_WHEEL = 4;

    // ---- Chassis physics ----
    // Lower box for low center of mass — prevents flips
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.35, 2.2));
    this.chassisBody = new CANNON.Body({ mass: 850 });
    // Offset the collision box UPWARD relative to the body origin. This places
    // the body's center of mass BELOW the box (at/below axle level) — the #1
    // fix for flipping. The visual mesh is re-aligned in syncVisuals().
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.7, 0));
    // Hard start height: drops cleanly onto raycast wheels/track.
    this.chassisBody.position.set(0, 2.0, 0);
    // High angular damping = "air friction" for rotations → no wild spins/flips.
    this.chassisBody.angularDamping = 0.7;
    this.chassisBody.linearDamping = 0.05;
    this.chassisBody.collisionFilterGroup = GROUP_CHASSIS;
    // Chassis collides with ground only — never with wheels
    this.chassisBody.collisionFilterMask = GROUP_GROUND;
    world.addBody(this.chassisBody);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOptions: CANNON.WheelInfoOptions = {
      radius: 0.3,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      // Stiffer suspension resists body lean during hard cornering.
      suspensionStiffness: 38,
      suspensionRestLength: 0.5,
      // High frictionSlip → strong grip, no clipping/sliding
      frictionSlip: 10.5,
      dampingRelaxation: 2.5,
      dampingCompression: 4.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0.005, // ~0 → centrifugal force barely tilts the car
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const halfWidth = 0.95;
    const wheelZ = 1.55;
    // Wheel raycast anchors sit slightly above the ground contact line.
    const wheelY = -0.2;
    const positions: CANNON.Vec3[] = [
      new CANNON.Vec3(halfWidth, wheelY, wheelZ), // FR
      new CANNON.Vec3(-halfWidth, wheelY, wheelZ), // FL
      new CANNON.Vec3(halfWidth, wheelY, -wheelZ), // RR
      new CANNON.Vec3(-halfWidth, wheelY, -wheelZ), // RL
    ];
    for (const p of positions) {
      wheelOptions.chassisConnectionPointLocal = p;
      this.vehicle.addWheel(wheelOptions);
    }
    this.vehicle.addToWorld(world);

    // Assign wheel material to all internal wheel bodies created by RaycastVehicle.
    // This pairs with the wheel<->ground ContactMaterial defined in Game.ts.
    if (wheelMaterial) {
      for (const info of this.vehicle.wheelInfos) {
        // @ts-expect-error material is supported on WheelInfo at runtime
        info.material = wheelMaterial;
      }
    }

    // ---- Visuals ----
    this.chassisMesh = this.buildCarMesh();
    scene.add(this.chassisMesh);

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      const wheel = this.vehicle.wheelInfos[i];
      const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(wheel.radius, wheel.radius, 0.3, 24),
        new THREE.MeshStandardMaterial({
          color: "#0a0a0f",
          roughness: 0.6,
          metalness: 0.3,
          emissive: "#10ffe6",
          emissiveIntensity: 0.15,
        }),
      );
      mesh.geometry.rotateZ(Math.PI / 2);
      mesh.castShadow = true;
      this.wheelMeshes.push(mesh);
      scene.add(mesh);
    }

    // ---- Lights ----
    this.headlightL = this.createHeadlight();
    this.headlightR = this.createHeadlight();
    this.chassisMesh.add(this.headlightL);
    this.chassisMesh.add(this.headlightL.target);
    this.chassisMesh.add(this.headlightR);
    this.chassisMesh.add(this.headlightR.target);
    this.headlightL.position.set(-0.55, 0.2, 2.2);
    this.headlightR.position.set(0.55, 0.2, 2.2);
    this.headlightL.target.position.set(-0.55, -0.5, 12);
    this.headlightR.target.position.set(0.55, -0.5, 12);

    this.taillightL = new THREE.PointLight("#ff1f5a", 2.2, 6, 2);
    this.taillightR = new THREE.PointLight("#ff1f5a", 2.2, 6, 2);
    this.taillightL.position.set(-0.55, 0.2, -2.2);
    this.taillightR.position.set(0.55, 0.2, -2.2);
    this.chassisMesh.add(this.taillightL);
    this.chassisMesh.add(this.taillightR);
  }

  private createHeadlight() {
    const l = new THREE.SpotLight("#dff6ff", 14, 55, Math.PI / 7, 0.4, 1.4);
    l.castShadow = false;
    return l;
  }

  private buildCarMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#1b0a35",
      metalness: 0.85,
      roughness: 0.25,
      emissive: "#ff3df0",
      emissiveIntensity: 0.12,
    });
    const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2, 0.55, 4.4), bodyMat);
    lowerBody.position.y = 0.05;
    lowerBody.castShadow = true;
    group.add(lowerBody);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.6, 2.2),
      new THREE.MeshStandardMaterial({
        color: "#05080f",
        metalness: 0.9,
        roughness: 0.15,
        emissive: "#10ffe6",
        emissiveIntensity: 0.25,
      }),
    );
    cabin.position.set(0, 0.55, -0.1);
    cabin.castShadow = true;
    group.add(cabin);

    // Underglow strip
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.05, 4.45),
      new THREE.MeshBasicMaterial({ color: "#ff3df0" }),
    );
    glow.position.y = -0.28;
    group.add(glow);

    return group;
  }

  applyControls(input: { forward: number; backward: number; left: number; right: number; brake: boolean; nitro: boolean; handbrake: boolean }, dt: number) {
    const speed = this.chassisBody.velocity.length();
    const speedKmh = speed * 3.6;

    // Smooth steering — less twitchy at speed
    const steerSpeedFactor = 1 - Math.min(0.55, speedKmh / 320);
    const targetSteer = (input.left - input.right) * this.tuning.maxSteer * steerSpeedFactor;
    this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1, dt * 8);

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    // Engine force — RWD
    let engineForce = 0;
    if (input.forward) engineForce = -this.tuning.maxEngineForce;
    if (input.backward) engineForce = this.tuning.maxEngineForce * 0.55;
    if (input.nitro && input.forward) engineForce *= this.tuning.nitroMultiplier;

    // ---- Drift exit boost: short 1.2x engine multiplier after releasing drift ----
    if (this.exitBoostTime > 0) {
      this.exitBoostTime = Math.max(0, this.exitBoostTime - dt);
      if (input.forward) engineForce *= 1.2;
    }

    // Drift trigger — slip-angle model. Driver-initiated via Space/H, OR
    // implicit when steering hard at speed. Engine force is preserved so the
    // car keeps momentum through the slide.
    const sharpSteer = Math.abs(this.currentSteer) > this.tuning.maxSteer * 0.6;
    const driftTrigger = input.handbrake || (sharpSteer && speedKmh > 55);
    this.isDrifting = driftTrigger;
    if (driftTrigger) this.driftTime += dt;
    else this.driftTime = 0;

    // Detect drift release → arm exit boost (~0.6s window)
    if (this.wasDrifting && !driftTrigger && speedKmh > 40) {
      this.exitBoostTime = 0.6;
    }
    this.wasDrifting = driftTrigger;

    // ---- Slip-angle stability assist ----
    // Compute angle between car's forward vector and its velocity. When the
    // slide gets wide, ramp front grip up so the player can "catch" it by
    // counter-steering and exit cleanly.
    const forwardLocal = new CANNON.Vec3(0, 0, -1);
    const forwardWorld = this.chassisBody.quaternion.vmult(forwardLocal);
    const vel = this.chassisBody.velocity;
    const velLen = vel.length();
    let slipAngle = 0;
    if (velLen > 2) {
      const dot = (forwardWorld.x * vel.x + forwardWorld.y * vel.y + forwardWorld.z * vel.z) / velLen;
      slipAngle = Math.acos(Math.max(-1, Math.min(1, Math.abs(dot)))); // 0..PI/2
    }
    const wideSlip = slipAngle > 0.45; // ~26°+

    const rearFriction = driftTrigger ? this.rearGripDrift : this.rearGripBase;
    const frontFriction = driftTrigger
      ? wideSlip
        ? this.frontGripStabilityAssist
        : this.frontGripDriftAssist
      : this.frontGripBase;
    this.vehicle.wheelInfos[0].frictionSlip = frontFriction;
    this.vehicle.wheelInfos[1].frictionSlip = frontFriction;
    this.vehicle.wheelInfos[2].frictionSlip = rearFriction;
    this.vehicle.wheelInfos[3].frictionSlip = rearFriction;

    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);

    // Brakes (dedicated brake key — no longer Space, which is now drift)
    const brakeForce = input.brake ? this.tuning.maxBrakeForce : 0;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i);

    // ---- Torque vectoring ----
    // Subtle yaw impulse while drifting + steering helps the chassis rotate
    // smoothly into the corner without feeling on rails.
    if (driftTrigger && Math.abs(this.currentSteer) > 0.05 && speedKmh > 30) {
      const yawDir = this.currentSteer > 0 ? 1 : -1;
      const yawStrength = 1400 * Math.min(1, speedKmh / 140) * dt;
      const yawImpulse = new CANNON.Vec3(0, yawDir * yawStrength, 0);
      this.chassisBody.angularVelocity.y += yawImpulse.y / 850; // mass-normalized
    }

    // ---- Body roll: tilt chassis mesh outward into the turn while drifting ----
    const targetRoll = driftTrigger
      ? -this.steerNormalized * 0.12 * Math.min(1, speedKmh / 120)
      : 0;
    this.bodyRoll += (targetRoll - this.bodyRoll) * Math.min(1, dt * 6);

    // ---- Downforce: glue car to road. Baseline = mass*10, scales with speed. ----
    const mass = this.chassisBody.mass;
    const downforce = mass * 10 + Math.min(12000, speed * speed * 14);
    const localDown = new CANNON.Vec3(0, -1, 0);
    const worldDown = this.chassisBody.quaternion.vmult(localDown);
    worldDown.scale(downforce, worldDown);
    this.chassisBody.applyForce(worldDown, this.chassisBody.position);
  }

  /** Seconds the car has been continuously drifting (for nitro recharge). */
  get driftDuration() {
    return this.driftTime;
  }

  /** Normalized steering input (-1..1) for camera look-at offset. */
  get steerNormalized() {
    return this.currentSteer / this.tuning.maxSteer;
  }

  syncVisuals() {
    // Visual mesh is offset DOWN by the same amount the collision shape was
    // offset UP, so the rendered car sits where it always did even though the
    // body's center of mass is now at/below axle level.
    const shapeOffset = 0.7;
    const bodyPos = this.chassisBody.position;
    const localOffset = new CANNON.Vec3(0, -shapeOffset, 0);
    const worldOffset = this.chassisBody.quaternion.vmult(localOffset);
    this.chassisMesh.position.set(
      bodyPos.x + worldOffset.x,
      bodyPos.y + worldOffset.y,
      bodyPos.z + worldOffset.z,
    );
    this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);
    // Apply body-roll tilt around local Z (visual only — does not affect physics).
    if (this.bodyRoll !== 0) {
      const rollQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.bodyRoll);
      this.chassisMesh.quaternion.multiply(rollQ);
    }

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const t = this.vehicle.wheelInfos[i].worldTransform;
      const m = this.wheelMeshes[i];
      m.position.copy(t.position as unknown as THREE.Vector3);
      m.quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
    }
  }

  resetToTrack() {
    this.chassisBody.position.set(0, 2.0, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.set(0, 0, 0, 1);
  }

  get drifting() {
    return this.isDrifting;
  }

  get speedKmh() {
    return this.chassisBody.velocity.length() * 3.6;
  }
}
