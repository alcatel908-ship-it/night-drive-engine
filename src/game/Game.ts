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
  private targetFov: number;
  private currentFov: number;
  private hudTick = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.sceneManager = new SceneManager(canvas);
    this.targetFov = this.sceneManager.baseFov;
    this.currentFov = this.sceneManager.baseFov;

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.4;

    // Infinite ground plane
    const groundBody = new CANNON.Body({ mass: 0, shape: new CANNON.Plane() });
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.world.addBody(groundBody);

    this.vehicle = new VehicleController(this.world, this.sceneManager.scene);
    this.input = new InputHandler();
    this.input.attach();
    this.camera = new FollowCamera(this.sceneManager.camera);
  }

  private nitroBoost(active: boolean, dt: number) {
    const state = useGameState.getState();
    let nitro = state.nitro;
    let actuallyActive = false;
    if (active && nitro > 0) {
      nitro = Math.max(0, nitro - dt * 28);
      actuallyActive = true;
    } else {
      nitro = Math.min(100, nitro + dt * 9);
    }
    if (state.nitro !== nitro) state.setNitro(nitro);
    if (state.nitroActive !== actuallyActive) state.setNitroActive(actuallyActive);
    this.targetFov = actuallyActive ? this.sceneManager.baseFov + 14 : this.sceneManager.baseFov;
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

    // Nitro gating (only when going forward & has fuel)
    const wantNitro = this.input.state.nitro && this.input.state.forward > 0;
    const nitroOn = this.nitroBoost(wantNitro, dt);

    this.vehicle.applyControls(
      { ...this.input.state, nitro: nitroOn },
      dt,
    );

    this.world.step(1 / 60, dt, 3);
    this.vehicle.syncVisuals();
    this.camera.update(this.vehicle.chassisMesh, this.vehicle.speedKmh, dt);

    // Smooth FOV
    this.currentFov += (this.targetFov - this.currentFov) * Math.min(1, dt * 4);
    this.sceneManager.setFov(this.currentFov);

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
    this.clock.start();
    this.rafId = requestAnimationFrame(this.loop);
  }

  dispose() {
    cancelAnimationFrame(this.rafId);
    this.input.detach();
    this.sceneManager.dispose();
  }
}
