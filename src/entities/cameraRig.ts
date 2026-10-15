import { Vector3, PerspectiveCamera } from 'three/webgpu';
import {
  FOLLOW_OFFSET,
  LOOK_AT_OFFSET_Y,
  PITCH_MIN,
  PITCH_MAX,
  AUTO_RECENTER_TIME,
  DAMPING,
  MIN_HEIGHT_ABOVE_TERRAIN,
  FOV_BASE,
  FOV_RUN,
} from '../config/camera';
import { heightAt } from '../world/terrain';

function damp(current: number, target: number, lambda: number, dt: number): number {
  const t = Math.exp(-lambda * dt);
  return current * t + target * (1 - t);
}

export class CameraRig {
  private pitch = 0;
  private yawOffset = 0;
  private isDragging = false;
  private dragPointerId: number | null = null;
  private lastMX = 0;
  private lastMY = 0;
  private lastDragTime = 0;
  private readonly sensitivity = 0.005;
  private snapped = false;

  constructor(private dom: HTMLElement, private camera: PerspectiveCamera) {
    const r = FOLLOW_OFFSET.length();
    this.pitch = Math.asin(FOLLOW_OFFSET.y / r);

    dom.style.touchAction = 'none';
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('pointercancel', this.onPointerUp);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  destroy() {
    this.dom.removeEventListener('pointerdown', this.onPointerDown);
    this.dom.removeEventListener('pointermove', this.onPointerMove);
    this.dom.removeEventListener('pointerup', this.onPointerUp);
    this.dom.removeEventListener('pointercancel', this.onPointerUp);
  }

  /** Camera direction yaw relative to +Z, including orbit offset */
  getCameraYaw(horseYaw: number): number {
    return horseYaw + this.yawOffset;
  }

  /** Snap camera immediately to ideal follow position */
  snapTo(horsePos: Vector3, horseYaw: number) {
    const r = FOLLOW_OFFSET.length();
    const totalYaw = horseYaw + this.yawOffset;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    const offsetX = -Math.sin(totalYaw) * r * cosP;
    const offsetY = r * sinP;
    const offsetZ = -Math.cos(totalYaw) * r * cosP;

    this.camera.position.set(
      horsePos.x + offsetX,
      horsePos.y + offsetY,
      horsePos.z + offsetZ
    );

    const lookAt = new Vector3(
      horsePos.x,
      horsePos.y + LOOK_AT_OFFSET_Y,
      horsePos.z
    );
    this.camera.lookAt(lookAt);
    this.snapped = true;
  }

  update(dt: number, horsePos: Vector3, horseYaw: number, isMoving: boolean, groundSpeed: number) {
    const r = FOLLOW_OFFSET.length();
    const totalYaw = horseYaw + this.yawOffset;
    const cosP = Math.cos(this.pitch);
    const sinP = Math.sin(this.pitch);

    const offsetX = -Math.sin(totalYaw) * r * cosP;
    const offsetY = r * sinP;
    const offsetZ = -Math.cos(totalYaw) * r * cosP;

    const idealPos = new Vector3(
      horsePos.x + offsetX,
      horsePos.y + offsetY,
      horsePos.z + offsetZ
    );

    const lookAt = new Vector3(
      horsePos.x,
      horsePos.y + LOOK_AT_OFFSET_Y,
      horsePos.z
    );

    // Smooth position with exponential damping
    if (!this.snapped) {
      const smoothFactor = 1 - Math.exp(-DAMPING * dt);
      this.camera.position.lerp(idealPos, smoothFactor);
    }
    this.snapped = false;

    // Terrain collision - keep camera above ground
    const terrainY = heightAt(this.camera.position.x, this.camera.position.z);
    const minY = terrainY + MIN_HEIGHT_ABOVE_TERRAIN;
    if (this.camera.position.y < minY) {
      this.camera.position.y = minY;
    }

    this.camera.lookAt(lookAt);

    // Auto-recentre yaw offset after not dragging while moving
    if (isMoving && !this.isDragging) {
      const timeSinceDrag = performance.now() / 1000 - this.lastDragTime;
      if (timeSinceDrag > AUTO_RECENTER_TIME && Math.abs(this.yawOffset) > 0.01) {
        this.yawOffset = damp(this.yawOffset, 0, 1.0 / 0.6, dt);
      }
    }

    // FOV adjustment while running
    const targetFov = Math.abs(groundSpeed) > 4.5 ? FOV_RUN : FOV_BASE;
    this.camera.fov = damp(this.camera.fov, targetFov, 1.0 / 0.3, dt);
    this.camera.updateProjectionMatrix();
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.dragPointerId !== null || (e.button !== 0 && e.button !== 2)) return;
    this.dragPointerId = e.pointerId;
    this.isDragging = true;
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;
    this.dom.setPointerCapture(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.isDragging || e.pointerId !== this.dragPointerId) return;
    const dx = e.clientX - this.lastMX;
    const dy = e.clientY - this.lastMY;
    this.lastMX = e.clientX;
    this.lastMY = e.clientY;

    this.yawOffset -= dx * this.sensitivity;
    this.pitch += dy * this.sensitivity;
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));

    this.lastDragTime = performance.now() / 1000;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerId !== this.dragPointerId) return;
    this.dragPointerId = null;
    this.isDragging = false;
    this.lastDragTime = performance.now() / 1000;
  };
}
