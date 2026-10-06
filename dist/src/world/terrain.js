import { PlaneGeometry, Mesh, MeshStandardMaterial, TextureLoader, RepeatWrapping } from 'three/webgpu';
export const heightAt = (x, z) => Math.sin(x * 0.04) * 1.2 + Math.cos(z * 0.035) * 1.0 + Math.sin((x + z) * 0.012) * 2.5;
export function createTerrain() {
    const size = 200;
    const segments = 200;
    const geo = new PlaneGeometry(size, size, segments, segments);
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
    loader.load('/textures/grass_ground/Diffuse_2k.jpg', (tex) => {
        tex.wrapS = RepeatWrapping;
        tex.wrapT = RepeatWrapping;
        tex.repeat.set(20, 20);
        material.map = tex;
        material.needsUpdate = true;
    }, undefined, () => {
        console.warn('Ground texture not found at /textures/grass_ground/Diffuse_2k.jpg');
    });
    const mesh = new Mesh(geo, material);
    mesh.receiveShadow = true;
    return mesh;
}
