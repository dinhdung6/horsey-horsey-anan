import { Vector3 } from 'three/webgpu';

export const FOLLOW_OFFSET = new Vector3(0, 2.2, -5.5);
export const LOOK_AT_OFFSET_Y = 1.2; // metres above horse origin
export const PITCH_MIN = -10 * Math.PI / 180;
export const PITCH_MAX = 60 * Math.PI / 180;
export const FOV_BASE = 60;
export const FOV_RUN = 68;
export const AUTO_RECENTER_TIME = 2.0; // seconds
export const DAMPING = 5.0; // exponential damping lambda
export const MIN_HEIGHT_ABOVE_TERRAIN = 0.6;
