import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';

const MAX_PIXEL_RATIO = 2;

export async function createRenderer(container: HTMLElement): Promise<WebGPURenderer> {
  const renderer = new WebGPURenderer({ antialias: true });
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.7;
  await renderer.init();

  function handleResize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
  }

  handleResize();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  container.appendChild(renderer.domElement);

  window.addEventListener('resize', handleResize);

  return renderer;
}

export function getBackendName(renderer: WebGPURenderer): string {
  try {
    const backend = (renderer as any).backend;
    if (!backend) return 'unknown';
    if (backend.name === 'webgpu') return 'WebGPU';
    if (backend.name === 'webgl') return 'WebGL2';
    return backend.name;
  } catch {
    return 'unknown';
  }
}
