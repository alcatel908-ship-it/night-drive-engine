import * as THREE from "three";

export class FollowCamera {
  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private offset = new THREE.Vector3(0, 4.2, -9);
  private lookOffset = new THREE.Vector3(0, 1.2, 6);
  private shakeTime = 0;
  private steerLook = 0;
  private punchTime = 0; // gear-shift FOV punch (seconds remaining)
  private readonly punchDuration = 0.18;
  private readonly punchAmount = 6; // FOV degrees

  // Dynamic FOV
  baseFov = 72;
  private currentFov = 72;

  constructor(private camera: THREE.PerspectiveCamera) {
    this.baseFov = camera.fov;
    this.currentFov = camera.fov;
  }

  /** Trigger a brief FOV "punch" (zoom in then out). */
  triggerShiftPunch() {
    this.punchTime = this.punchDuration;
  }

  /**
   * @param target       chassis mesh
   * @param speedKmh     current car speed
   * @param dt           delta time
   * @param steer        -1..1 steering intensity (for look-at offset)
   * @param nitroActive  is nitro firing — adds shake + extra zoom
   */
  update(
    target: THREE.Object3D,
    speedKmh: number,
    dt: number,
    steer = 0,
    nitroActive = false,
  ) {
    // ---- Dynamic FOV: zoom out with speed; extra punch on nitro ----
    const speedFov = THREE.MathUtils.clamp(speedKmh / 320, 0, 1) * 18;
    const nitroFov = nitroActive ? 12 : 0;
    const targetFov = this.baseFov + speedFov + nitroFov;
    this.currentFov += (targetFov - this.currentFov) * Math.min(1, dt * 4);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Pull camera back slightly faster as speed rises
    const speedPull = Math.min(4, speedKmh * 0.025);
    const offset = this.offset.clone().add(new THREE.Vector3(0, 0, -speedPull));

    // ---- Look-at Offset: bias look target sideways with steering ----
    const targetSteerLook = steer * 4.5;
    this.steerLook += (targetSteerLook - this.steerLook) * Math.min(1, dt * 5);

    const desiredPos = offset.clone().applyQuaternion(target.quaternion).add(target.position);
    const lookOff = this.lookOffset.clone();
    lookOff.x += this.steerLook;
    const desiredLook = lookOff.applyQuaternion(target.quaternion).add(target.position);

    // Elastic smoothing — lower = more lag
    const posLerp = 1 - Math.exp(-dt * 6);
    const lookLerp = 1 - Math.exp(-dt * 9);

    this.currentPos.lerp(desiredPos, posLerp);
    this.currentLook.lerp(desiredLook, lookLerp);

    // ---- Camera Shake: top-speed rumble + nitro burst ----
    const topSpeedShake = THREE.MathUtils.clamp((speedKmh - 220) / 120, 0, 1);
    const nitroShake = nitroActive ? 0.6 : 0;
    const shakeAmount = topSpeedShake * 0.12 + nitroShake * 0.18;
    this.shakeTime += dt * (40 + speedKmh * 0.15);
    const shakeX = Math.sin(this.shakeTime * 1.7) * shakeAmount;
    const shakeY = Math.cos(this.shakeTime * 2.3) * shakeAmount * 0.7;

    this.camera.position.copy(this.currentPos);
    this.camera.position.x += shakeX;
    this.camera.position.y += shakeY;
    this.camera.lookAt(this.currentLook);
  }
}
