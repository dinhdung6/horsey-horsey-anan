import { PerspectiveCamera, Vector3 } from 'three';

export class FreeFlyCamera {
  yaw = 0;
  pitch = 0.3;
  pos = new Vector3(0, 8, 20);
  speed = 10;
  mouseSensitivity = 0.003;

  private keys: Record<string, boolean> = {};
  private dragging = false;
  private lastX = 0;
  private lastY = 0;

  constructor(private dom: HTMLElement) {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    dom.addEventListener('mousedown', this.onMouseDown);
    dom.addEventListener('mousemove', this.onMouseMove);
    dom.addEventListener('mouseup', this.onMouseUp);
    dom.addEventListener('contextmenu', e => e.preventDefault());
  }

  destroy() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.dom.removeEventListener('mousedown', this.onMouseDown);
    this.dom.removeEventListener('mousemove', this.onMouseMove);
    this.dom.removeEventListener('mouseup', this.onMouseUp);
  }

  update(dt: number) {
    const forward = new Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const up = new Vector3(0, 1, 0);

    const s = this.speed;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) this.pos.addScaledVector(forward, s * dt);
    if (this.keys['KeyS'] || this.keys['ArrowDown']) this.pos.addScaledVector(forward, -s * dt);
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) this.pos.addScaledVector(right, -s * dt);
    if (this.keys['KeyD'] || this.keys['ArrowRight']) this.pos.addScaledVector(right, s * dt);
    if (this.keys['KeyQ'] || this.keys['Space']) this.pos.addScaledVector(up, s * dt);
    if (this.keys['KeyE'] || this.keys['ShiftLeft'] || this.keys['ShiftRight']) this.pos.addScaledVector(up, -s * dt);
  }

  apply(camera: PerspectiveCamera) {
    const look = new Vector3(
      -Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * Math.cos(this.pitch)
    ).normalize();
    camera.position.copy(this.pos);
    camera.lookAt(this.pos.clone().add(look));
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    this.keys[e.code] = true;
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys[e.code] = false;
  };
  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0 || e.button === 2) {
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    }
  };
  private onMouseMove = (e: MouseEvent) => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yaw -= dx * this.mouseSensitivity;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch - dy * this.mouseSensitivity));
  };
  private onMouseUp = () => {
    this.dragging = false;
  };
}
