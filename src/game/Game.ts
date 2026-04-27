import * as THREE from "three";
import * as CANNON from "cannon-es";
import { SceneManager } from "./SceneManager";
import { VehicleController } from "./VehicleController";
import { InputHandler } from "./InputHandler";
import { FollowCamera } from "./FollowCamera";
import { useGameState } from "./GameState";

export class Game {
  private sceneManager: SceneManager;
  private world: CANNON.World;
  private vehicle: VehicleController;
  private input: InputHandler;
  private camera: FollowCamera;
  private clock = new THREE.Clock();
  private rafId = 0;
  private hudTick = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.sceneManager = new SceneManager(canvas);

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.4;

    // Materials — wheels vs ground need a dedicated ContactMaterial
    // so the RaycastVehicle gets predictable grip and no clipping/sliding.
    const groundMaterial = new CANNON.Material("ground");
    const wheelMaterial = new CANNON.Material("wheel");
    const wheelGround = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
      friction: 1.0,
      restitution: 0.0,
    });
    this.world.addContactMaterial(wheelGround);

    // Infinite ground plane (uses ground material)
    const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    // Ground in its own collision group; chassis collides with ground but NOT wheels
    groundBody.collisionFilterGroup = 1; // GROUP_GROUND
    groundBody.collisionFilterMask = -1; // collide with everything
    this.world.addBody(groundBody);

    this.vehicle = new VehicleController(this.world, this.sceneManager.scene, wheelMaterial);
    this.input = new InputHandler();
    this.input.attach();
    this.camera = new FollowCamera(this.sceneManager.camera);
  }

  private nitroBoost(active: boolean, dt: number, driftRecharge: boolean) {
    const state = useGameState.getState();
    let nitro = state.nitro;
    let actuallyActive = false;
    if (active && nitro > 0) {
      nitro = Math.max(0, nitro - dt * 28);
      actuallyActive = true;
    } else {
      // Faster recharge while drifting (>1s of continuous drift).
      const rechargeRate = driftRecharge ? 22 : 9;
      nitro = Math.min(100, nitro + dt * rechargeRate);
    }
    if (state.nitro !== nitro) state.setNitro(nitro);
    if (state.nitroActive !== actuallyActive) state.setNitroActive(actuallyActive);
    return actuallyActive;
  }

  /** Public boost API */
  boost() {
    // Manual trigger — sets a brief nitro pulse
    this.input.setMobileInput({ nitro: true });
    setTimeout(() => this.input.setMobileInput({ nitro: false }), 1500);
  }

  private loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta());

    // Drift-based nitro recharge after >1s of continuous sliding
    const driftRecharge = this.vehicle.driftDuration > 1.0;

    // Nitro gating (only when going forward & has fuel)
    const wantNitro = this.input.state.nitro && this.input.state.forward > 0;
    const nitroOn = this.nitroBoost(wantNitro, dt, driftRecharge);

    this.vehicle.applyControls(
      { ...this.input.state, nitro: nitroOn },
      dt,
    );

    this.world.step(1 / 60, dt, 3);
    this.vehicle.syncVisuals();
    this.camera.update(
      this.vehicle.chassisMesh,
      this.vehicle.speedKmh,
      dt,
      this.vehicle.steerNormalized,
      nitroOn,
    );


    // HUD updates throttled to ~10fps to avoid React churn
    this.hudTick += dt;
    if (this.hudTick > 0.1) {
      this.hudTick = 0;
      const state = useGameState.getState();
      const speed = this.vehicle.speedKmh;
      state.setSpeed(speed);
      const gear = Math.min(6, Math.max(1, Math.floor(speed / 45) + 1));
      state.setGear(gear);
      state.setRpm(Math.min(9000, 1200 + (speed % 45) * 170));
    }

    this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    this.rafId = requestAnimationFrame(this.loop);
  };

  start() {
    this.vehicle.resetToTrack();
    this.clock.start();
    this.rafId = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.sceneManager.dispose();
  }
}
