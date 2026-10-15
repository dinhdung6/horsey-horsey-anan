import { WebGPURenderer, ACESFilmicToneMapping } from 'three/webgpu';

const MAX_PIXEL_RATIO = 2;
const resizeHandlers = new WeakMap<WebGPURenderer, () => void>();

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
  resizeHandlers.set(renderer, handleResize);

  return renderer;
}

export function disposeRenderer(renderer: WebGPURenderer) {
  const handleResize = resizeHandlers.get(renderer);
  if (handleResize) window.removeEventListener('resize', handleResize);
  resizeHandlers.delete(renderer);
  renderer.domElement.remove();
  renderer.dispose();
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
