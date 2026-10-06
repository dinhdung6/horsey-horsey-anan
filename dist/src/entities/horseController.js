import { heightAt } from '../world/terrain';
import { WALK_SPEED, RUN_SPEED, REVERSE_SPEED, ACCEL_TIME, TURN_RATE_WALK, TURN_RATE_RUN, JUMP_VELOCITY, GRAVITY, COYOTE_TIME, } from '../config/controller';
function damp(current, target, lambda, dt) {
    const t = Math.exp(-lambda * dt);
    return current * t + target * (1 - t);
}
export class HorseController {
    speed = 0;
    verticalVel = 0;
    isGrounded = true;
    timeSinceGrounded = 0;
    tiltPitch = 0;
    tiltRoll = 0;
    horse;
    yaw = 0;
    pos = { x: 0, y: 0, z: 0 };
    frameBite = null;
    eating = false;
    sitting = false;
    eatTimer = 0;
    constructor(horse) {
        this.horse = horse;
        this.pos.x = horse.root.position.x;
        this.pos.y = horse.root.position.y;
        this.pos.z = horse.root.position.z;
        this.yaw = horse.root.rotation.y;
    }
    update(dt, input) {
        const groundY = heightAt(this.pos.x, this.pos.z);
        this.isGrounded = this.pos.y <= groundY + 0.03;
        if (this.isGrounded) {
            this.timeSinceGrounded = 0;
            this.pos.y = groundY;
            this.verticalVel = 0;
        }
        else {
            this.timeSinceGrounded += dt;
        }
        // ── Sit toggle ──
        if (input.sitToggle && this.isGrounded) {
            this.sitting = !this.sitting;
            if (this.sitting)
                this.eating = false;
        }
        // ── Movement cancels sit/eat ──
        if (input.moveX !== 0 || input.moveZ !== 0 || input.jumpPressed) {
            if (this.sitting)
                this.sitting = false;
            if (this.eating)
                this.eating = false;
        }
        // ── Eat (only when standing still) ──
        if (input.eatHeld && this.isGrounded && !this.sitting && input.moveX === 0 && input.moveZ === 0) {
            if (!this.eating) {
                this.eating = true;
                this.eatTimer = 0;
            }
        }
        else {
            this.eating = false;
        }
        // ── Jump (cannot while sitting) ──
        if (input.jumpPressed && !this.sitting && (this.isGrounded || this.timeSinceGrounded <= COYOTE_TIME)) {
            this.isGrounded = false;
            this.verticalVel = JUMP_VELOCITY;
            this.eating = false;
        }
        // ── Horizontal movement ──
        let targetSpeed = 0;
        let turnRate = TURN_RATE_WALK;
        if (this.sitting || this.eating) {
            targetSpeed = 0;
        }
        else {
            if (input.moveZ > 0) {
                targetSpeed = input.run ? RUN_SPEED : WALK_SPEED;
                turnRate = input.run ? TURN_RATE_RUN : TURN_RATE_WALK;
            }
            else if (input.moveZ < 0) {
                targetSpeed = -REVERSE_SPEED;
            }
        }
        this.speed = damp(this.speed, targetSpeed, 1.0 / ACCEL_TIME, dt);
        // Yaw steering (only when not eating/sitting)
        if (!this.sitting && !this.eating) {
            if (input.moveZ > 0) {
                this.yaw += input.moveX * turnRate * dt;
            }
            else {
                this.yaw += input.moveX * TURN_RATE_WALK * dt;
            }
        }
        this.pos.x += Math.sin(this.yaw) * this.speed * dt;
        this.pos.z += Math.cos(this.yaw) * this.speed * dt;
        // Vertical physics
        if (!this.isGrounded) {
            this.verticalVel -= GRAVITY * dt;
            this.pos.y += this.verticalVel * dt;
            const newGroundY = heightAt(this.pos.x, this.pos.z);
            if (this.pos.y <= newGroundY) {
                this.pos.y = newGroundY;
                this.isGrounded = true;
                this.verticalVel = 0;
            }
        }
        // Apply transform
        this.horse.root.position.set(this.pos.x, this.pos.y, this.pos.z);
        // Slope tilt
        this.applyGroundTilt(dt);
        // ── Animation state machine ──
        this.horse.sitting = this.sitting;
        if (!this.isGrounded) {
            this.horse.crossFadeTo('jump', Math.abs(this.speed), dt);
        }
        else if (this.eating) {
            this.horse.crossFadeTo('eat', 0, dt);
            // Generate bite point periodically
            this.eatTimer += dt;
            if (this.eatTimer > 0.5) {
                this.eatTimer = 0;
                const biteX = this.pos.x + Math.sin(this.yaw) * 0.7;
                const biteZ = this.pos.z + Math.cos(this.yaw) * 0.7;
                this.frameBite = { x: biteX, z: biteZ };
            }
        }
        else if (this.sitting) {
            this.horse.crossFadeTo('sit', 0, dt);
        }
        else if (Math.abs(this.speed) > 4.0) {
            this.horse.crossFadeTo('run', Math.abs(this.speed), dt);
        }
        else if (Math.abs(this.speed) > 0.2) {
            this.horse.crossFadeTo('walk', Math.abs(this.speed), dt);
        }
        else {
            this.horse.crossFadeTo('idle', 0, dt);
        }
    }
    applyGroundTilt(dt) {
        const off = 0.8;
        const hF = heightAt(this.pos.x + Math.sin(this.yaw) * off, this.pos.z + Math.cos(this.yaw) * off);
        const hB = heightAt(this.pos.x - Math.sin(this.yaw) * off, this.pos.z - Math.cos(this.yaw) * off);
        const hL = heightAt(this.pos.x - Math.cos(this.yaw) * off, this.pos.z + Math.sin(this.yaw) * off);
        const hR = heightAt(this.pos.x + Math.cos(this.yaw) * off, this.pos.z - Math.sin(this.yaw) * off);
        const targetPitch = Math.atan2(hF - hB, off * 2);
        const targetRoll = Math.atan2(hR - hL, off * 2);
        this.tiltPitch = damp(this.tiltPitch, targetPitch, 1.0 / 0.2, dt);
        this.tiltRoll = damp(this.tiltRoll, targetRoll, 1.0 / 0.2, dt);
        this.horse.root.rotation.set(this.tiltPitch, this.yaw, this.tiltRoll, 'YXZ');
    }
}
