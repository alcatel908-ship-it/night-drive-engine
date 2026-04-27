import * as THREE from "three";

export class SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  baseFov = 72;
  private resizeHandler: () => void;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#0a0618");
    this.scene.fog = new THREE.FogExp2("#0a0618", 0.018);

    this.camera = new THREE.PerspectiveCamera(
      this.baseFov,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1500,
    );
    this.camera.position.set(0, 6, -12);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.setupLights();
    this.setupNeonGround();

    this.resizeHandler = () => this.handleResize(canvas);
    window.addEventListener("resize", this.resizeHandler);
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight("#3a2f6b", 0.45);
    this.scene.add(ambient);

    const moon = new THREE.DirectionalLight("#9fb8ff", 0.8);
    moon.position.set(60, 120, 40);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -80;
    moon.shadow.camera.right = 80;
    moon.shadow.camera.top = 80;
    moon.shadow.camera.bottom = -80;
    this.scene.add(moon);

    // Rim neon glow
    const pink = new THREE.HemisphereLight("#ff3df0", "#10ffe6", 0.25);
    this.scene.add(pink);
  }

  private setupNeonGround() {
    // Dark base plane
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
    this.scene.add(base);

    // Neon grid overlay
    const grid = new THREE.GridHelper(2000, 200, "#10ffe6", "#ff3df0");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.55;
    grid.position.y = 0.01;
    this.scene.add(grid);

    // Distant neon pillars for vibe
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
      this.scene.add(pillar);
    }
  }

  private handleResize(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  setFov(fov: number) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    window.removeEventListener("resize", this.resizeHandler);
    this.renderer.dispose();
  }
}
