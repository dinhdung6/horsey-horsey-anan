const FIXED_DT = 1 / 60;
export function startLoop(renderer, scene, camera, onTick, fpsEl) {
    let lastTime = performance.now();
    let accumulator = 0;
    let frames = 0;
    let fpsAccum = 0;
    let rafId = 0;
    let running = true;
    function frame(now) {
        if (!running)
            return;
        const dt = Math.min((now - lastTime) / 1000, 0.25);
        lastTime = now;
        accumulator += dt;
        while (accumulator >= FIXED_DT) {
            onTick(FIXED_DT);
            accumulator -= FIXED_DT;
        }
        renderer.render(scene, camera);
        frames++;
        fpsAccum += dt;
        if (fpsAccum >= 1) {
            fpsEl.textContent = `${frames} fps`;
            frames = 0;
            fpsAccum = 0;
        }
        rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);
    return () => {
        running = false;
        cancelAnimationFrame(rafId);
    };
}
