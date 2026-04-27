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

  constructor(world: CANNON.World, scene: THREE.Scene, wheelMaterial?: CANNON.Material) {
    // ---- Collision groups: chassis must NOT collide with its own wheels ----
    const GROUP_GROUND = 1;
    const GROUP_CHASSIS = 2;
    const GROUP_WHEEL = 4;

    // ---- Chassis physics ----
    // Lower box for low center of mass — prevents flips
    const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.35, 2.2));
    this.chassisBody = new CANNON.Body({ mass: 850 });
    this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0, 0));
    // Spawn high enough that wheels (radius 0.45) clear the ground
    this.chassisBody.position.set(0, 1.5, 0);
    this.chassisBody.angularDamping = 0.2;
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
      radius: 0.4,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 38,
      suspensionRestLength: 0.35,
      // High frictionSlip → strong grip, no clipping/sliding
      frictionSlip: 10.5,
      dampingRelaxation: 2.4,
      dampingCompression: 4.5,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01, // very low → resists flipping
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 0, 1),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true,
    };

    const halfWidth = 0.95;
    const wheelZ = 1.55;
    // Connect wheels at the chassis bottom so suspension extends correctly
    const wheelY = -0.35;
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
      for (const wb of this.vehicle.wheelBodies ?? []) {
        wb.material = wheelMaterial;
      }
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

    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);

    // Brakes
    const brakeForce = input.brake ? this.tuning.maxBrakeForce : 0;
    for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i);

    // Drift mode: handbrake OR sharp steering at speed → reduce rear friction
    const sharpSteer = Math.abs(this.currentSteer) > this.tuning.maxSteer * 0.6;
    const driftTrigger = input.handbrake || (sharpSteer && speedKmh > 55);
    this.isDrifting = driftTrigger;
    const rearFriction = driftTrigger ? 0.9 : 2.6;
    this.vehicle.wheelInfos[2].frictionSlip = rearFriction;
    this.vehicle.wheelInfos[3].frictionSlip = rearFriction;

    if (input.handbrake) {
      this.vehicle.setBrake(18, 2);
      this.vehicle.setBrake(18, 3);
    }
  }

  syncVisuals() {
    this.chassisMesh.position.copy(this.chassisBody.position as unknown as THREE.Vector3);
    this.chassisMesh.quaternion.copy(this.chassisBody.quaternion as unknown as THREE.Quaternion);

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.updateWheelTransform(i);
      const t = this.vehicle.wheelInfos[i].worldTransform;
      const m = this.wheelMeshes[i];
      m.position.copy(t.position as unknown as THREE.Vector3);
      m.quaternion.copy(t.quaternion as unknown as THREE.Quaternion);
    }
  }

  get drifting() {
    return this.isDrifting;
  }

  get speedKmh() {
    return this.chassisBody.velocity.length() * 3.6;
  }
}
