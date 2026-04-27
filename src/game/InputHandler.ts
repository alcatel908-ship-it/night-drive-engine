export type InputState = {
  forward: number; // 0..1
  backward: number; // 0..1
  left: number; // 0..1
  right: number; // 0..1
  brake: boolean;
  nitro: boolean;
  handbrake: boolean;
};

export class InputHandler {
  state: InputState = {
    forward: 0,
    backward: 0,
    left: 0,
    right: 0,
    brake: false,
    nitro: false,
    handbrake: false,
  };

  private keys = new Set<string>();
  private bound = false;
  private handleDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    this.sync();
  };
  private handleUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    this.sync();
  };

  attach() {
    if (this.bound) return;
    window.addEventListener("keydown", this.handleDown);
    window.addEventListener("keyup", this.handleUp);
    this.bound = true;
  }

  detach() {
    window.removeEventListener("keydown", this.handleDown);
    window.removeEventListener("keyup", this.handleUp);
    this.bound = false;
  }

  // Mobile UI placeholder — call from on-screen button handlers
  setMobileInput(partial: Partial<InputState>) {
    Object.assign(this.state, partial);
  }

  private sync() {
    const k = this.keys;
    this.state.forward = k.has("KeyW") || k.has("ArrowUp") ? 1 : 0;
    this.state.backward = k.has("KeyS") || k.has("ArrowDown") ? 1 : 0;
    this.state.left = k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0;
    this.state.right = k.has("KeyD") || k.has("ArrowRight") ? 1 : 0;
    this.state.brake = k.has("Space");
    this.state.nitro = k.has("ShiftLeft") || k.has("ShiftRight");
    this.state.handbrake = k.has("KeyH");
  }
}
