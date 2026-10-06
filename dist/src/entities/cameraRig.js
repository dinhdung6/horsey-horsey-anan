import { Vector3 } from 'three/webgpu';
import { FOLLOW_OFFSET, LOOK_AT_OFFSET_Y, PITCH_MIN, PITCH_MAX, AUTO_RECENTER_TIME, DAMPING, MIN_HEIGHT_ABOVE_TERRAIN, FOV_BASE, FOV_RUN, } from '../config/camera';
import { heightAt } from '../world/terrain';
function damp(current, target, lambda, dt) {
    const t = Math.exp(-lambda * dt);
    return current * t + target * (1 - t);
}
export class CameraRig {
    dom;
    camera;
    pitch = 0;
    yawOffset = 0;
    isDragging = false;
    lastMX = 0;
    lastMY = 0;
    lastDragTime = 0;
    sensitivity = 0.005;
    snapped = false;
    constructor(dom, camera) {
        this.dom = dom;
        this.camera = camera;
        const r = FOLLOW_OFFSET.length();
        this.pitch = Math.asin(FOLLOW_OFFSET.y / r);
        dom.addEventListener('mousedown', this.onMouseDown);
        dom.addEventListener('mousemove', this.onMouseMove);
        dom.addEventListener('mouseup', this.onMouseUp);
        dom.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    destroy() {
        this.dom.removeEventListener('mousedown', this.onMouseDown);
        this.dom.removeEventListener('mousemove', this.onMouseMove);
        this.dom.removeEventListener('mouseup', this.onMouseUp);
    }
    /** Camera direction yaw relative to +Z, including orbit offset */
    getCameraYaw(horseYaw) {
        return horseYaw + this.yawOffset;
    }
    /** Snap camera immediately to ideal follow position */
    snapTo(horsePos, horseYaw) {
        const r = FOLLOW_OFFSET.length();
        const totalYaw = horseYaw + this.yawOffset;
        const cosP = Math.cos(this.pitch);
        const sinP = Math.sin(this.pitch);
        const offsetX = -Math.sin(totalYaw) * r * cosP;
        const offsetY = r * sinP;
        const offsetZ = -Math.cos(totalYaw) * r * cosP;
        this.camera.position.set(horsePos.x + offsetX, horsePos.y + offsetY, horsePos.z + offsetZ);
        const lookAt = new Vector3(horsePos.x, horsePos.y + LOOK_AT_OFFSET_Y, horsePos.z);
        this.camera.lookAt(lookAt);
        this.snapped = true;
    }
    update(dt, horsePos, horseYaw, isMoving, groundSpeed) {
        const r = FOLLOW_OFFSET.length();
        const totalYaw = horseYaw + this.yawOffset;
        const cosP = Math.cos(this.pitch);
        const sinP = Math.sin(this.pitch);
        const offsetX = -Math.sin(totalYaw) * r * cosP;
        const offsetY = r * sinP;
        const offsetZ = -Math.cos(totalYaw) * r * cosP;
        const idealPos = new Vector3(horsePos.x + offsetX, horsePos.y + offsetY, horsePos.z + offsetZ);
        const lookAt = new Vector3(horsePos.x, horsePos.y + LOOK_AT_OFFSET_Y, horsePos.z);
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
    onMouseDown = (e) => {
        if (e.button === 0 || e.button === 2) {
            this.isDragging = true;
            this.lastMX = e.clientX;
            this.lastMY = e.clientY;
        }
    };
    onMouseMove = (e) => {
        if (!this.isDragging)
            return;
        const dx = e.clientX - this.lastMX;
        const dy = e.clientY - this.lastMY;
        this.lastMX = e.clientX;
        this.lastMY = e.clientY;
        this.yawOffset -= dx * this.sensitivity;
        this.pitch += dy * this.sensitivity;
        this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch));
        this.lastDragTime = performance.now() / 1000;
    };
    onMouseUp = () => {
        this.isDragging = false;
        this.lastDragTime = performance.now() / 1000;
    };
}
