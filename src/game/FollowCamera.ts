import * as THREE from "three";

export class FollowCamera {
  private currentPos = new THREE.Vector3();
  private currentLook = new THREE.Vector3();
  private offset = new THREE.Vector3(0, 4.2, -9);
  private lookOffset = new THREE.Vector3(0, 1.2, 6);

  constructor(private camera: THREE.PerspectiveCamera) {}

  update(target: THREE.Object3D, speedKmh: number, dt: number) {
    // Pull camera back slightly faster as speed rises
    const speedPull = Math.min(4, speedKmh * 0.025);
    const offset = this.offset.clone().add(new THREE.Vector3(0, 0, -speedPull));

    const desiredPos = offset.clone().applyQuaternion(target.quaternion).add(target.position);
    const desiredLook = this.lookOffset
      .clone()
      .applyQuaternion(target.quaternion)
      .add(target.position);

    // Elastic smoothing — lower = more lag
    const posLerp = 1 - Math.exp(-dt * 6);
    const lookLerp = 1 - Math.exp(-dt * 9);

    this.currentPos.lerp(desiredPos, posLerp);
    this.currentLook.lerp(desiredLook, lookLerp);

    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
  }
}
