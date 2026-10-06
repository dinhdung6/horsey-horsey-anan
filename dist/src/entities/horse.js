import { AnimationMixer, Group } from 'three/webgpu';
import { CLIPS } from '../config/animations';
import { WALK_SPEED, RUN_SPEED } from '../config/controller';
export class Horse {
    root = new Group();
    mixer = null;
    actions = {};
    currentAction = null;
    currentClipName = '';
    sitting = false;
    sitTargetY = -0.4;
    sitCurrentY = 0;
    constructor(gltf) {
        gltf.scene.scale.setScalar(0.5);
        gltf.scene.position.y = 0;
        gltf.scene.rotation.y = 0;
        this.root.add(gltf.scene);
        this.mixer = new AnimationMixer(gltf.scene);
        for (const clip of gltf.animations) {
            this.actions[clip.name] = this.mixer.clipAction(clip);
        }
        const idleClip = this.resolveClip('idle') ?? 'Idle';
        this.play(idleClip, 0);
    }
    play(clipName, crossFadeDuration = 0.3) {
        if (!this.actions[clipName]) {
            console.warn('Horse animation not found:', clipName);
            return;
        }
        if (this.currentAction === this.actions[clipName])
            return;
        if (this.currentAction) {
            this.currentAction.fadeOut(crossFadeDuration);
        }
        const action = this.actions[clipName];
        action.reset().fadeIn(crossFadeDuration).play();
        this.currentAction = action;
        this.currentClipName = clipName;
    }
    crossFadeTo(animState, groundSpeed, _dt) {
        // Sit must be handled even when there is no dedicated clip
        if (animState === 'sit') {
            const idleName = this.resolveClip('idle') ?? 'Idle';
            if (idleName && this.currentClipName !== idleName) {
                this.play(idleName, 0.3);
            }
            return;
        }
        const clipName = this.resolveClip(animState);
        if (!clipName)
            return;
        if (animState === 'jump') {
            if (this.currentClipName === clipName)
                return;
            this.play(clipName, 0.2);
            return;
        }
        // Scale playback speed by actual ground speed to avoid foot sliding
        if (animState === 'walk' || animState === 'run') {
            const action = this.actions[clipName];
            if (action) {
                const ref = animState === 'walk' ? WALK_SPEED : RUN_SPEED;
                action.timeScale = ref > 0 ? Math.max(0.2, groundSpeed / ref) : 1;
            }
        }
        if (this.currentClipName !== clipName) {
            this.play(clipName);
        }
    }
    update(dt) {
        this.mixer?.update(dt);
        // Smooth sit root lowering
        const target = this.sitting ? this.sitTargetY : 0;
        const lambda = 1.0 / 0.3; // 0.3s blend
        const t = Math.exp(-lambda * dt);
        this.sitCurrentY = this.sitCurrentY * t + target * (1 - t);
        this.root.children[0].position.y = this.sitCurrentY;
    }
    resolveClip(state) {
        const candidates = CLIPS[state];
        if (!candidates)
            return null;
        for (const name of candidates) {
            if (this.actions[name])
                return name;
        }
        return null;
    }
}
