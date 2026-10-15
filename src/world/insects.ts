import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  SphereGeometry,
  Scene,
} from 'three/webgpu';
import { GrassSystem } from './grass';
import { heightAt } from './terrain';

const BUTTERFLIES_PER_CHUNK = 2;
const FIREFLIES_PER_CHUNK = 3;

export class Insects {
  private butterflies: InstancedMesh | null = null;
  private fireflies: InstancedMesh | null = null;
  private readonly dummy = new Object3D();
  private readonly offsets: Array<{ x: number; z: number; phase: number }> = [];
  private readonly fireflyOffsets: Array<{ x: number; z: number; phase: number }> = [];
  private night = false;
  private chunkCount = 0;

  constructor(private readonly grass: GrassSystem, private readonly scene: Scene) {
    this.syncChunkCount();
  }

  private syncChunkCount() {
    const chunkCount = this.grass.chunks.length;
    const count = chunkCount * BUTTERFLIES_PER_CHUNK;
    const fireflyCount = chunkCount * FIREFLIES_PER_CHUNK;
    if (this.butterflies && this.chunkCount === chunkCount) return;
    this.disposeMeshes();
    this.chunkCount = chunkCount;

    const wings = new BufferGeometry();
    wings.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0, -0.55, 0.08, 0, -0.24, 0.42, 0,
      0, 0, 0, -0.24, 0.08, 0, -0.34, -0.22, 0,
      0, 0, 0, 0.55, 0.08, 0, 0.24, 0.42, 0,
      0, 0, 0, 0.24, 0.08, 0, 0.34, -0.22, 0,
    ], 3));
    wings.computeVertexNormals();
    this.butterflies = new InstancedMesh(
      wings,
      new MeshBasicMaterial({ color: 0xffdf9b, side: DoubleSide }),
      count
    );
    this.butterflies.frustumCulled = false;
    this.fireflies = new InstancedMesh(
      new SphereGeometry(0.055, 5, 4),
      new MeshBasicMaterial({ color: 0xf2ff5a, toneMapped: false }),
      fireflyCount
    );
    this.fireflies.frustumCulled = false;
    this.fireflies.count = this.night ? fireflyCount : 0;
    this.scene.add(this.butterflies, this.fireflies);

    this.offsets.length = count;
    for (let i = 0; i < count; i++) {
      this.offsets[i] = {
        x: (Math.random() - 0.5) * 11,
        z: (Math.random() - 0.5) * 11,
        phase: Math.random() * Math.PI * 2,
      };
    }
    this.fireflyOffsets.length = fireflyCount;
    for (let i = 0; i < fireflyCount; i++) {
      this.fireflyOffsets[i] = {
        x: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 10,
        phase: Math.random() * Math.PI * 2,
      };
    }
  }

  setNight(night: boolean) {
    this.night = night;
    if (this.butterflies) this.butterflies.count = night ? 0 : this.offsets.length;
    if (this.fireflies) this.fireflies.count = night ? this.fireflyOffsets.length : 0;
  }

  update(time: number) {
    this.syncChunkCount();
    if (!this.butterflies || !this.fireflies) return;
    this.setNight(this.night);
    let i = 0;
    for (let chunkIndex = 0; chunkIndex < this.grass.chunks.length; chunkIndex++) {
      const chunk = this.grass.chunks[chunkIndex];
      for (let local = 0; local < BUTTERFLIES_PER_CHUNK; local++, i++) {
        const offset = this.offsets[i];
        const x = chunk.originX + offset.x;
        const z = chunk.originZ + offset.z;
        const phase = time * 2.4 + offset.phase;
        this.dummy.position.set(x + Math.sin(phase) * 0.35, heightAt(x, z) + 1.0 + Math.sin(phase * 1.7) * 0.12, z + Math.cos(phase) * 0.35);
        this.dummy.rotation.set(Math.sin(phase) * 0.45, phase, Math.sin(phase * 5) * 0.35);
        this.dummy.scale.setScalar(0.18);
        this.dummy.updateMatrix();
        this.butterflies.setMatrixAt(i, this.dummy.matrix);
      }
      for (let local = 0; local < FIREFLIES_PER_CHUNK; local++) {
        const fireflyIndex = chunkIndex * FIREFLIES_PER_CHUNK + local;
        const offset = this.fireflyOffsets[fireflyIndex];
        const phase = time * 2 + offset.phase;
        const x = chunk.originX + offset.x;
        const z = chunk.originZ + offset.z;
        this.dummy.position.set(x + Math.sin(phase) * 0.25, heightAt(x, z) + 0.8 + Math.sin(phase * 1.5) * 0.18, z + Math.cos(phase) * 0.25);
        this.dummy.scale.setScalar(1.2 + (Math.sin(phase * 3) + 1) * 0.2);
        this.dummy.rotation.set(0, 0, 0);
        this.dummy.updateMatrix();
        this.fireflies.setMatrixAt(fireflyIndex, this.dummy.matrix);
      }
    }
    this.butterflies.instanceMatrix.needsUpdate = true;
    this.fireflies.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.disposeMeshes();
  }

  private disposeMeshes() {
    for (const mesh of [this.butterflies, this.fireflies]) {
      if (!mesh) continue;
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as MeshBasicMaterial).dispose();
    }
    this.butterflies = null;
    this.fireflies = null;
    this.chunkCount = 0;
  }
}
