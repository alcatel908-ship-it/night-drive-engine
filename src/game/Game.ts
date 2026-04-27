import * as THREE from "three";
import * as CANNON from "cannon-es";
import { SceneManager } from "./SceneManager";
import { VehicleController } from "./VehicleController";
import { InputHandler } from "./InputHandler";
import { FollowCamera } from "./FollowCamera";
import { Track } from "./Track";
import { useGameState } from "./GameState";

export class Game {
  private sceneManager: SceneManager;
  private world: CANNON.World;
  private vehicle: VehicleController;
  private input: InputHandler;
  private camera: FollowCamera;
  private track: Track;
  private clock = new THREE.Clock();
  private rafId = 0;
  private hudTick = 0;
  private prevReset = false;

  constructor(canvas: HTMLCanvasElement) {
    this.sceneManager = new SceneManager(canvas);

    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.defaultContactMaterial.friction = 0.4;

    const groundMaterial = new CANNON.Material("ground");
    const wheelMaterial = new CANNON.Material("wheel");
    const wheelGround = new CANNON.ContactMaterial(wheelMaterial, groundMaterial, {
      friction: 1.0,
      restitution: 0.0,
    });
    this.world.addContactMaterial(wheelGround);

    const groundBody = new CANNON.Body({ mass: 0, material: groundMaterial });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    groundBody.collisionFilterGroup = 1;
    groundBody.collisionFilterMask = -1;
    this.world.addBody(groundBody);

    // Track is now decoupled from SceneManager so it can be swapped for
    // imported geometry, splines, or richer environments later.
    this.track = new Track(this.sceneManager.scene);

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
      const rechargeRate = driftRecharge ? 22 : 9;
      nitro = Math.min(100, nitro + dt * rechargeRate);
    }
    if (state.nitro !== nitro) state.setNitro(nitro);
    if (state.nitroActive !== actuallyActive) state.setNitroActive(actuallyActive);
    return actuallyActive;
  }

  boost() {
    this.input.setMobileInput({ nitro: true });
    setTimeout(() => this.input.setMobileInput({ nitro: false }), 1500);
  }

  private loop = () => {
    const dt = Math.min(0.05, this.clock.getDelta());

    // Wrap the entire physics + sync block. A single bad frame must NOT
    // freeze the render loop — log it and keep ticking.
    try {
      // Edge-triggered respawn on 'R'
      if (this.input.state.reset && !this.prevReset) {
        this.vehicle.resetToTrack();
      }
      this.prevReset = this.input.state.reset;

      const driftRecharge = this.vehicle.driftDuration > 1.0;
      const wantNitro = this.input.state.nitro && this.input.state.forward > 0;
      const nitroOn = this.nitroBoost(wantNitro, dt, driftRecharge);

      this.vehicle.applyControls({ ...this.input.state, nitro: nitroOn }, dt);

      // Hard-frame downforce — pulled from vehicle config so it scales with profile.
      this.vehicle.chassisBody.applyForce(
        new CANNON.Vec3(0, -this.vehicle.config.baseDownforce, 0),
        this.vehicle.chassisBody.position,
      );

      this.world.step(1 / 60, dt, 3);
      this.vehicle.syncVisuals();

      // Camera FOV punch synced to gearbox shift event
      if (this.vehicle.shiftJustHappened) {
        this.camera.triggerShiftPunch();
      }

      this.camera.update(
        this.vehicle.chassisMesh,
        this.vehicle.speedKmh,
        dt,
        this.vehicle.steerNormalized,
        nitroOn,
      );

      this.hudTick += dt;
      if (this.hudTick > 0.1) {
        this.hudTick = 0;
        const state = useGameState.getState();
        let speed = this.vehicle.speedKmh;
        if (this.vehicle.atRevLimit) {
          speed += (Math.random() - 0.5) * 6;
        }
        state.setSpeed(speed);
        state.setGear(this.vehicle.gearNumber);
        state.setGearLabel(this.vehicle.gearLabel);
        state.setRevLimit(this.vehicle.atRevLimit);
        state.setRpm(this.vehicle.rpm);
        const grounded = this.vehicle.isGrounded();
        if (state.grounded !== grounded) state.setGrounded(grounded);
        if (state.drifting !== this.vehicle.drifting) state.setDrifting(this.vehicle.drifting);
      }
    } catch (err) {
      // Don't kill the loop on a transient physics glitch.
      console.error("[Game.loop] frame error:", err);
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
