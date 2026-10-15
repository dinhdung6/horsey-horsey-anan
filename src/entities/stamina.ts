import { STAMINA } from '../config/stamina';

export class Stamina {
  value: number = STAMINA.max;
  exhausted = false;
  private eatTime = 0;

  get canGallop() {
    return !this.exhausted;
  }

  update(dt: number, galloping: boolean, eating: boolean, grounded: boolean, stopped: boolean) {
    const recovering = eating && grounded && stopped;
    this.eatTime = recovering ? this.eatTime + dt : 0;

    if (galloping) this.value -= STAMINA.gallopDrain * dt;
    else if (recovering && this.eatTime > STAMINA.eatDelay) this.value += STAMINA.eatRestore * dt;
    else this.value += STAMINA.idleRegen * dt;

    this.value = Math.max(0, Math.min(STAMINA.max, this.value));
    if (this.value <= 0) this.exhausted = true;
    else if (this.exhausted && this.value >= STAMINA.recoverThreshold) this.exhausted = false;
  }

  consume(amount: number) {
    this.value = Math.max(0, this.value - amount);
    if (this.value <= 0) this.exhausted = true;
  }
}
