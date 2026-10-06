export class AutoPilot {
    mode = 'idle';
    timer = 0;
    target = { x: 0, z: 0 };
    isActive = false;
    noInputTimer = 0;
    runMode = false;
    update(dt, horseX, horseZ, horseYaw, input) {
        if (input.moveX !== 0 || input.moveZ !== 0 || input.jumpPressed || input.sitToggle || input.eatHeld) {
            this.noInputTimer = 0;
            if (this.isActive) {
                this.isActive = false;
                this.mode = 'idle';
            }
            return input;
        }
        this.noInputTimer += dt;
        if (!this.isActive && this.noInputTimer > 8) {
            this.isActive = true;
            this.mode = 'idle';
            this.timer = 1 + Math.random() * 2;
        }
        if (!this.isActive)
            return input;
        this.timer -= dt;
        if (this.timer <= 0) {
            if (this.mode === 'idle') {
                this.mode = Math.random() < 0.3 ? 'eating' : 'walking';
                if (this.mode === 'walking') {
                    this.pickNewTarget(horseX, horseZ);
                    this.runMode = Math.random() < 0.2;
                    this.timer = 999;
                }
                else {
                    this.timer = 3 + Math.random() * 5;
                }
            }
            else {
                const rnd = Math.random();
                if (rnd < 0.4) {
                    this.mode = 'idle';
                    this.timer = 2 + Math.random() * 4;
                }
                else if (rnd < 0.8) {
                    this.mode = 'eating';
                    this.timer = 3 + Math.random() * 5;
                }
                else {
                    this.mode = 'walking';
                    this.pickNewTarget(horseX, horseZ);
                    this.runMode = Math.random() < 0.2;
                    this.timer = 999;
                }
            }
        }
        const out = { moveX: 0, moveZ: 0, jumpPressed: false, run: false, sitToggle: false, eatHeld: false };
        if (this.mode === 'walking') {
            const dx = this.target.x - horseX;
            const dz = this.target.z - horseZ;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 2) {
                this.timer = 0;
                return out;
            }
            const targetYaw = Math.atan2(dx, dz);
            let diff = targetYaw - horseYaw;
            diff = ((diff + Math.PI) % (Math.PI * 2)) - Math.PI;
            out.moveZ = 1;
            out.moveX = Math.sign(diff) * Math.min(Math.abs(diff) / 1.5, 1);
            out.run = this.runMode;
        }
        else if (this.mode === 'eating') {
            out.eatHeld = true;
        }
        return out;
    }
    pickNewTarget(horseX, horseZ) {
        const a = Math.random() * Math.PI * 2;
        const d = 15 + Math.random() * 25;
        this.target.x = horseX + Math.sin(a) * d;
        this.target.z = horseZ + Math.cos(a) * d;
    }
}
