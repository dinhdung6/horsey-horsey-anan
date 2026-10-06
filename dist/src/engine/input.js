export class InputManager {
    state = {
        moveX: 0,
        moveZ: 0,
        run: false,
        jumpPressed: false,
        sitToggle: false,
        eatHeld: false,
    };
    keys = new Set();
    jumpWasDown = false;
    sitWasDown = false;
    attach() {
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
    }
    detach() {
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
    }
    tick() {
        const jumpDown = this.keys.has('Space');
        this.state.jumpPressed = jumpDown && !this.jumpWasDown;
        this.jumpWasDown = jumpDown;
        const sitDown = this.keys.has('KeyC');
        this.state.sitToggle = sitDown && !this.sitWasDown;
        this.sitWasDown = sitDown;
        this.state.eatHeld = this.keys.has('KeyE');
        this.state.run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
        this.state.moveX = 0;
        this.state.moveZ = 0;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))
            this.state.moveX -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight'))
            this.state.moveX += 1;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))
            this.state.moveZ += 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))
            this.state.moveZ -= 1;
    }
    onKeyDown = (e) => {
        if (e.repeat)
            return;
        this.keys.add(e.code);
    };
    onKeyUp = (e) => {
        this.keys.delete(e.code);
    };
}
