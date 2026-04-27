import * as THREE from "three";
import * as CANNON from "cannon-es";
import { VEHICLE_CONFIG, type VehicleConfig } from "./VehicleConfig";

export class VehicleController {
  vehicle: CANNON.RaycastVehicle;
  chassisBody: CANNON.Body;
  chassisMesh: THREE.Group;
  wheelMeshes: THREE.Mesh[] = [];
  headlightL: THREE.SpotLight;
  headlightR: THREE.SpotLight;
  taillightL: THREE.PointLight;
  taillightR: THREE.PointLight;

  config: VehicleConfig;

  private currentSteer = 0;
  private isDrifting = false;
  private driftTime = 0;
  private exitBoostTime = 0;
  private wasDrifting = false;
  private bodyRoll = 0;

  // ---- Transmission ----
  /** 0 = Reverse, 1 = Neutral, 2..7 = Gears 1..6 */
  private gearIndex = 2;
  /** Seconds remaining in clutch power-cut. */
  private shiftCooldown = 0;
  /** True for one frame right after a shift completes (for camera punch). */
  shiftJustHappened = false;
  /** True when speed is at top of the current gear (rev limiter). */
  atRevLimit = false;

  constructor(
    world: CANNON.World,
    scene: THREE.Scene,
    wheelMaterial?: CANNON.Material,
    config: VehicleConfig = VEHICLE_CONFIG,
  ) {
    this.config = config;

    // ---- Collision groups: chassis must NOT collide with its own wheels ----
    const GROUP_GROUND = 1;
    const GROUP_CHASSIS = 2;

    // ---- Chassis physics ----
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.35, 2.2));
    this.chassisBody = new CANNON.Body({ mass: this.config.mass });
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.7, 0));
    this.chassisBody.position.set(0, 2.0, 0);
    this.chassisBody.angularDamping = 0.7;
    this.chassisBody.angularFactor.set(0, 1, 0);
    this.chassisBody.linearDamping = 0.05;
    this.chassisBody.collisionFilterGroup = GROUP_CHASSIS;
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
      suspensionStiffness: 38,
      suspensionRestLength: 0.2,
      frictionSlip: this.config.baseGrip,
      dampingRelaxation: 2.5,
      dampingCompression: 4.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const halfWidth = 0.95;
    const wheelZ = 1.55;
    const wheelY = -0.2;
    const positions: CANNON.Vec3[] = [
      new CANNON.Vec3(halfWidth, wheelY, wheelZ),
      new CANNON.Vec3(-halfWidth, wheelY, wheelZ),
      new CANNON.Vec3(halfWidth, wheelY, -wheelZ),
      new CANNON.Vec3(-halfWidth, wheelY, -wheelZ),
    ];
    for (const p of positions) {
      wheelOptions.chassisConnectionPointLocal = p;
      this.vehicle.addWheel(wheelOptions);
    }
    this.vehicle.addToWorld(world);

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

    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.05, 0.05, 4.45),
      new THREE.MeshBasicMaterial({ color: "#ff3df0" }),
    );
    glow.position.y = -0.28;
    group.add(glow);

    return group;
  }

  applyControls(
    input: { forward: number; backward: number; left: number; right: number; brake: boolean; nitro: boolean; handbrake: boolean },
    dt: number,
  ) {
    const cfg = this.config;
    const speed = this.chassisBody.velocity.length();
    const speedKmh = speed * 3.6;

    // ---- Dynamic steering: reduce max angle at high speed to prevent spin-out
    const steerSpeedFactor = Math.max(
      cfg.minSteerFactor,
      1 - Math.min(1 - cfg.minSteerFactor, speedKmh / cfg.steerSpeedReference),
    );
    const targetSteer = (input.left - input.right) * cfg.maxSteering * steerSpeedFactor;
    this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1, dt * 8);

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    // ---- Engine force (RWD) ----
    let engineForce = 0;
    if (input.forward) engineForce = -cfg.engineForce;
    if (input.backward) engineForce = cfg.engineForce * 0.55;
    if (input.nitro && input.forward) engineForce *= cfg.nitroMultiplier;

    if (this.exitBoostTime > 0) {
      this.exitBoostTime = Math.max(0, this.exitBoostTime - dt);
      if (input.forward) engineForce *= cfg.driftExitBoost;
    }

    // ---- Drift detection ----
    const sharpSteer = Math.abs(this.currentSteer) > cfg.maxSteering * 0.6;
    const driftTrigger = input.handbrake || (sharpSteer && speedKmh > 55);
    this.isDrifting = driftTrigger;
    if (driftTrigger) this.driftTime += dt;
    else this.driftTime = 0;

    if (this.wasDrifting && !driftTrigger && speedKmh > 40) {
      this.exitBoostTime = 0.6;
    }
    this.wasDrifting = driftTrigger;

    // ---- Slip-angle stability assist ----
    const forwardLocal = new CANNON.Vec3(0, 0, -1);
    const forwardWorld = this.chassisBody.quaternion.vmult(forwardLocal);
    const vel = this.chassisBody.velocity;
    const velLen = vel.length();
    let slipAngle = 0;
    if (velLen > 2) {
      const dot = (forwardWorld.x * vel.x + forwardWorld.y * vel.y + forwardWorld.z * vel.z) / velLen;
      slipAngle = Math.acos(Math.max(-1, Math.min(1, Math.abs(dot))));
    }
    const wideSlip = slipAngle > 0.45;

    const rearFriction = driftTrigger ? cfg.driftFriction : cfg.baseGrip;
    const frontFriction = driftTrigger
      ? wideSlip
        ? cfg.frontGripStabilityAssist
        : cfg.frontGripDriftAssist
      : cfg.baseGrip;
    this.vehicle.wheelInfos[0].frictionSlip = frontFriction;
    this.vehicle.wheelInfos[1].frictionSlip = frontFriction;
    this.vehicle.wheelInfos[2].frictionSlip = rearFriction;
    this.vehicle.wheelInfos[3].frictionSlip = rearFriction;

    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);

    const brakeForce = input.brake ? cfg.brakingForce : 0;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i);

    // ---- Torque vectoring while drifting ----
    if (driftTrigger && Math.abs(this.currentSteer) > 0.05 && speedKmh > 30) {
      const yawDir = this.currentSteer > 0 ? 1 : -1;
      const yawStrength = 1400 * Math.min(1, speedKmh / 140) * dt;
      this.chassisBody.angularVelocity.y += (yawDir * yawStrength) / cfg.mass;
    }

    // ---- Velocity alignment (linear grip) ----
    // When NOT drifting, gradually rotate the velocity vector toward the
    // chassis forward axis. Removes the "soap on ice" sideways slide while
    // preserving the sliding feel during drifts.
    if (!driftTrigger && velLen > 3 && this.isGrounded()) {
      const forwardSpeed = forwardWorld.x * vel.x + forwardWorld.y * vel.y + forwardWorld.z * vel.z;
      // target velocity = pure forward component along chassis forward
      const targetVx = forwardWorld.x * forwardSpeed;
      const targetVy = vel.y; // never touch vertical; gravity owns it
      const targetVz = forwardWorld.z * forwardSpeed;
      const k = Math.min(1, dt * cfg.velocityAlignment);
      vel.x += (targetVx - vel.x) * k;
      vel.z += (targetVz - vel.z) * k;
      vel.y = targetVy;
    }

    // ---- Aerodynamic drag (quadratic in speed) ----
    if (velLen > 0.1) {
      const dragMag = cfg.dragCoefficient * velLen * velLen;
      const dragForce = new CANNON.Vec3(
        -(vel.x / velLen) * dragMag,
        0,
        -(vel.z / velLen) * dragMag,
      );
      this.chassisBody.applyForce(dragForce, this.chassisBody.position);
    }

    // ---- Body roll visual ----
    const targetRoll = driftTrigger
      ? -this.steerNormalized * 0.12 * Math.min(1, speedKmh / 120)
      : 0;
    this.bodyRoll += (targetRoll - this.bodyRoll) * Math.min(1, dt * 6);

    // ---- Speed-scaled downforce ----
    const downforce = Math.min(8000, speed * speed * cfg.speedDownforce);
    this.chassisBody.applyForce(new CANNON.Vec3(0, -downforce, 0), this.chassisBody.position);
  }

  /** True if any wheel has ground contact this step. */
  isGrounded() {
    for (const w of this.vehicle.wheelInfos) {
      if (w.isInContact) return true;
    }
    return false;
  }

  get driftDuration() {
    return this.driftTime;
  }

  get steerNormalized() {
    return this.currentSteer / this.config.maxSteering;
  }

  syncVisuals() {
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

  /** Respawn: lift to (0, 5, 0), zero velocity, upright. */
  resetToTrack() {
    this.chassisBody.position.set(0, 5, 0);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.angularFactor.set(0, 1, 0);
    this.chassisBody.quaternion.set(0, 0, 0, 1);
    this.currentSteer = 0;
    this.driftTime = 0;
    this.exitBoostTime = 0;
    this.bodyRoll = 0;
  }

  get drifting() {
    return this.isDrifting;
  }

  get speedKmh() {
    return this.chassisBody.velocity.length() * 3.6;
  }
}
