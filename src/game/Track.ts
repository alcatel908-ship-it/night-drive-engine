import * as THREE from "three";

/**
 * Track module — owns all environment visuals (ground plane, neon grid,
 * pillars). Kept separate from SceneManager and VehicleController so the
 * environment can be swapped (e.g. real circuit, GLTF imports) without
 * touching the physics loop.
 */
export class Track {
  group: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group();
    this.buildGround();
    this.buildPillars();
    scene.add(this.group);
  }

  private buildGround() {
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(2000, 2000),
      new THREE.MeshStandardMaterial({
        color: "#080418",
        roughness: 0.9,
        metalness: 0.1,
      }),
    );
    base.rotation.x = -Math.PI / 2;
    base.receiveShadow = true;
    this.group.add(base);

    const grid = new THREE.GridHelper(2000, 200, "#10ffe6", "#ff3df0");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    grid.position.y = 0.01;
    this.group.add(grid);
  }

  private buildPillars() {
    for (let i = 0; i < 60; i++) {
      const isPink = Math.random() > 0.5;
      const color = isPink ? "#ff3df0" : "#10ffe6";
      const h = 8 + Math.random() * 30;
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(2, h, 2),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 1.4,
          roughness: 0.4,
        }),
      );
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 400;
      pillar.position.set(Math.cos(angle) * dist, h / 2, Math.sin(angle) * dist);
      this.group.add(pillar);
    }
  }
}
