import { PlaneGeometry, Mesh, MeshStandardMaterial, TextureLoader, RepeatWrapping } from 'three/webgpu';

export const heightAt = (x: number, z: number): number =>
  Math.sin(x * 0.04) * 1.2 + Math.cos(z * 0.035) * 1.0 + Math.sin((x + z) * 0.012) * 2.5;

const TERRAIN_SIZE = 200;
const TERRAIN_SEGMENTS = 200;
const TERRAIN_RECENTER_STEP = 40;

export function createTerrain(): Mesh {
  const geo = new PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEGMENTS, TERRAIN_SEGMENTS);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  geo.computeVertexNormals();

  const material = new MeshStandardMaterial({
    color: 0x4a6e3a,
    roughness: 0.85,
    metalness: 0.0,
  });

  // Try texture; if missing, keep the solid colour
  const loader = new TextureLoader();
  loader.load(
    '/textures/grass_ground/Diffuse_2k.jpg',
    (tex) => {
      tex.wrapS = RepeatWrapping;
      tex.wrapT = RepeatWrapping;
      tex.repeat.set(20, 20);
      material.map = tex;
      material.needsUpdate = true;
    },
    undefined,
    () => {
      console.warn('Ground texture not found at /textures/grass_ground/Diffuse_2k.jpg');
    }
  );

  const mesh = new Mesh(geo, material);
  mesh.receiveShadow = true;
  mesh.userData.terrainCenterX = 0;
  mesh.userData.terrainCenterZ = 0;
  return mesh;
}

export function updateTerrain(mesh: Mesh, worldX: number, worldZ: number): void {
  const centerX = Math.round(worldX / TERRAIN_RECENTER_STEP) * TERRAIN_RECENTER_STEP;
  const centerZ = Math.round(worldZ / TERRAIN_RECENTER_STEP) * TERRAIN_RECENTER_STEP;
  if (centerX === mesh.userData.terrainCenterX && centerZ === mesh.userData.terrainCenterZ) return;

  const pos = mesh.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(centerX + pos.getX(i), centerZ + pos.getZ(i)));
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
  mesh.geometry.computeBoundingSphere();
  mesh.position.set(centerX, 0, centerZ);
  mesh.userData.terrainCenterX = centerX;
  mesh.userData.terrainCenterZ = centerZ;
}
