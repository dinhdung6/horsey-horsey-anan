import type { InputManager } from '../engine/input';

export function createTouchControls(input: InputManager, enabled: boolean) {
  const root = document.createElement('div');
  root.className = 'touch-controls';
  root.hidden = !enabled;
  document.body.classList.toggle('has-touch-controls', enabled);
  root.innerHTML = '<div class="touch-stick"><div class="touch-stick-knob"></div></div><div class="touch-actions"><button type="button" class="touch-lock" aria-pressed="false">Gallop lock</button><button type="button" class="touch-jump">Jump</button><button type="button" class="touch-eat">Eat</button></div>';
  document.body.append(root);

  const stick = root.querySelector<HTMLElement>('.touch-stick')!;
  const knob = root.querySelector<HTMLElement>('.touch-stick-knob')!;
  const lock = root.querySelector<HTMLButtonElement>('.touch-lock')!;
  const jump = root.querySelector<HTMLButtonElement>('.touch-jump')!;
  const eat = root.querySelector<HTMLButtonElement>('.touch-eat')!;
  let pointerId: number | null = null;
  let x = 0;
  let y = 0;
  let gallopLocked = false;
  let jumpHeld = false;
  let eatHeld = false;

  function update() {
    const magnitude = Math.hypot(x, y);
    input.setTouchInput({
      moveX: -x,
      moveZ: -y,
      run: y < -0.05 && (gallopLocked || magnitude >= 0.72),
      jump: jumpHeld,
      eat: eatHeld,
    });
  }
  function move(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    const rect = stick.getBoundingClientRect();
    const radius = rect.width * 0.38;
    const dx = (event.clientX - (rect.left + rect.width / 2)) / radius;
    const dy = (event.clientY - (rect.top + rect.height / 2)) / radius;
    const length = Math.hypot(dx, dy);
    const scale = length > 1 ? 1 / length : 1;
    x = dx * scale;
    y = dy * scale;
    knob.style.transform = `translate(${x * radius}px, ${y * radius}px)`;
    update();
  }
  function release(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    x = y = 0;
    knob.style.transform = '';
    update();
  }

  stick.addEventListener('pointerdown', (event) => {
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    stick.setPointerCapture(pointerId);
    move(event);
  });
  stick.addEventListener('pointermove', move);
  stick.addEventListener('pointerup', release);
  stick.addEventListener('pointercancel', release);
  lock.addEventListener('click', () => {
    gallopLocked = !gallopLocked;
    lock.setAttribute('aria-pressed', String(gallopLocked));
    lock.classList.toggle('is-active', gallopLocked);
    update();
  });
  const hold = (button: HTMLButtonElement, set: (value: boolean) => void) => {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      set(true);
      update();
    });
    const up = () => { set(false); update(); };
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
  };
  hold(jump, (value) => { jumpHeld = value; });
  hold(eat, (value) => { eatHeld = value; });

  return {
    setEnabled(value: boolean) {
      root.hidden = !value;
      document.body.classList.toggle('has-touch-controls', value);
      if (!value) {
        pointerId = null;
        x = y = 0;
        jumpHeld = eatHeld = false;
        knob.style.transform = '';
        update();
      }
    },
    destroy() {
      input.setTouchInput({ moveX: 0, moveZ: 0, run: false, jump: false, eat: false });
      document.body.classList.remove('has-touch-controls');
      root.remove();
    },
  };
}
