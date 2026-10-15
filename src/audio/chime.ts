const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

export function playChime(context: AudioContext, output: AudioNode, milestone: boolean) {
  const start = context.currentTime + 0.02;
  const notes = [0, 1, 2].map(() => SCALE[Math.floor(Math.random() * SCALE.length)]).sort((a, b) => a - b);
  if (milestone) notes.push(notes[2] * 2);
  notes.forEach((frequency, i) => {
    const time = start + i * 0.16;
    for (const [multiple, amplitude] of [[1, 1], [2.01, 0.35], [3.99, 0.12]] as const) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * multiple;
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.25 * amplitude, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);
      oscillator.connect(gain).connect(output);
      oscillator.start(time);
      oscillator.stop(time + 1.45);
    }
  });
}
