export function createStaminaBar() {
  const root = document.createElement('section');
  root.className = 'stamina-hud';
  root.setAttribute('aria-label', 'Horse stamina');
  root.innerHTML = `
    <span class="stamina-icon" aria-hidden="true">⚡</span>
    <div class="stamina-track" role="progressbar" aria-label="Sức bền" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100">
      <div class="stamina-fill"></div>
    </div>
    <span class="stamina-warning" aria-live="polite"></span>`;
  document.body.append(root);
  const fill = root.querySelector<HTMLElement>('.stamina-fill')!;
  const track = root.querySelector<HTMLElement>('.stamina-track')!;
  const icon = root.querySelector<HTMLElement>('.stamina-icon')!;
  const warning = root.querySelector<HTMLElement>('.stamina-warning')!;
  let fullIdleTime = 0;

  return {
    update(value: number, exhausted: boolean, idle: boolean, dt: number) {
      const percent = Math.round(value);
      const level = value <= 25 ? 'low' : value <= 60 ? 'medium' : 'high';
      fill.style.width = `${percent}%`;
      fill.dataset.level = level;
      icon.dataset.level = level;
      track.setAttribute('aria-valuenow', String(percent));
      track.title = `Sức bền: ${percent}%`;
      fullIdleTime = value >= 99.5 && idle ? fullIdleTime + dt : 0;
      root.style.opacity = fullIdleTime >= 3 ? '0.4' : '1';
      root.classList.toggle('is-exhausted', exhausted);
      warning.textContent = exhausted ? 'Hết sức — giữ E để ăn cỏ' : '';
    },
    shake() {
      root.classList.remove('is-shaking');
      void root.offsetWidth;
      root.classList.add('is-shaking');
    },
    destroy() { root.remove(); },
  };
}
