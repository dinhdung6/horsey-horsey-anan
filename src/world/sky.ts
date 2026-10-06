import {
  Scene,
  Color,
  FogExp2,
  DirectionalLight,
  AmbientLight,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  BackSide,
  CanvasTexture,
} from 'three/webgpu';

export function setupSkyAndFog(scene: Scene) {
  const skyTop = new Color(0x6a8cbc);
  const skyMid = new Color(0xd98c6a);
  const skyBot = new Color(0xffc870);
  const fogColor = new Color(0xd4a76a);

  scene.fog = new FogExp2(fogColor.getHex(), 0.012);
  scene.background = new Color(fogColor.getHex());

  const sun = new DirectionalLight(0xffe0b0, 2.5);
  sun.position.set(80, 30, -60);
  sun.castShadow = true;
  scene.add(sun);

  scene.add(new AmbientLight(0x406080, 0.4));

  const skyTex = makeGradientTexture(
    skyTop.getHexString(),
    skyMid.getHexString(),
    skyBot.getHexString()
  );
  const skyGeo = new SphereGeometry(400, 32, 16);
  const skyMat = new MeshBasicMaterial({ map: skyTex, side: BackSide });
  const skyMesh = new Mesh(skyGeo, skyMat);
  scene.add(skyMesh);

  return { sun };
}

function makeGradientTexture(top: string, mid: string, bot: string): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#' + top);
  grd.addColorStop(0.5, '#' + mid);
  grd.addColorStop(1, '#' + bot);
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = 'srgb' as any;
  return tex;
}
