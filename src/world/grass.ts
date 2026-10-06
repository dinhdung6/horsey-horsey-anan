import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedMesh,
  Object3D,
  DoubleSide,
  MeshBasicNodeMaterial,
  Vector3,
  Vector2,
} from 'three/webgpu';
import {
  attribute,
  mix,
  vec3,
  uniform,
  sin,
  cos,
  positionLocal,
  pow,
  float,
  clamp,
  smoothstep,
  min,
} from 'three/tsl';
import { heightAt } from './terrain';
import type { QualityPreset } from '../config/quality';

const CHUNK_SIZE = 16;
const BITE_CAPACITY = 8;
const BITE_RADIUS = 0.6;
const BITE_REGROW = 30.0;
const HORSE_PUSH_RADIUS = 1.2;

export class GrassChunk {
  mesh: InstancedMesh;
  originX = 0;
  originZ = 0;
  timeNode = uniform(0.0);
  horsePosNode = uniform(new Vector3(0, -999, 0));
  windStrengthNode = uniform(0.3);
  wetnessNode = uniform(0.0);
  bladesPerChunk: number;
  bitePosXZNodes: any[] = [];
  biteTimeNodes: any[] = [];
  biteWriteIndex = 0;

  constructor(bladesPerChunk = 5000) {
    this.bladesPerChunk = bladesPerChunk;
    for (let i = 0; i < BITE_CAPACITY; i++) {
      this.bitePosXZNodes.push(uniform(new Vector2(0, 0)));
      this.biteTimeNodes.push(uniform(-999));
    }

    const geo = new BufferGeometry();
    const positions = new Float32Array([
      0, 0.8, 0,
      -0.04, 0, 0,
      0.04, 0, 0,
    ]);
    const tVals = new Float32Array([1.0, 0.0, 0.0]);
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute('bladeT', new Float32BufferAttribute(tVals, 1));

    const bladeT = attribute('bladeT', 'float');

    // Wetness darkening (up to 40%)
    const wetnessDarken = float(1.0).sub(this.wetnessNode.mul(0.4));

    const rootColor = vec3(0.08, 0.18, 0.05);
    const tipColor = vec3(0.55, 0.75, 0.25);
    const colorNode = mix(rootColor, tipColor, pow(bladeT, float(1.3))).mul(
      wetnessDarken
    );

    const groundY = sin(positionLocal.x.mul(0.04)).mul(1.2)
      .add(cos(positionLocal.z.mul(0.035)))
      .add(sin(positionLocal.x.add(positionLocal.z).mul(0.012)).mul(2.5));

    const wind = sin(positionLocal.x.mul(0.3).add(this.timeNode.mul(1.2)))
      .mul(this.windStrengthNode).mul(bladeT).mul(bladeT);

    const hdx = positionLocal.x.sub((this.horsePosNode as any).x);
    const hdz = positionLocal.z.sub((this.horsePosNode as any).z);
    const hDistSq = hdx.mul(hdx).add(hdz.mul(hdz));
    const hDist = pow(hDistSq, 0.5);
    const hPushStrength = smoothstep(HORSE_PUSH_RADIUS, 0.0, hDist).mul(bladeT).mul(bladeT);
    const hPushX = hdx.div(hDist.add(0.001)).mul(hPushStrength);
    const hPushZ = hdz.div(hDist.add(0.001)).mul(hPushStrength);

    let biteScale: any = float(1.0);
    for (let i = 0; i < BITE_CAPACITY; i++) {
      const bpx = (this.bitePosXZNodes[i] as any).x;
      const bpz = (this.bitePosXZNodes[i] as any).y;
      const bdx = positionLocal.x.sub(bpx);
      const bdz = positionLocal.z.sub(bpz);
      const bDistSq = bdx.mul(bdx).add(bdz.mul(bdz));
      const bDist = pow(bDistSq, 0.5);
      const near = smoothstep(BITE_RADIUS, 0.0, bDist);
      const elapsed = this.timeNode.sub(this.biteTimeNodes[i]);
      const regrow = clamp(elapsed.mul(1.0 / BITE_REGROW), 0.0, 1.0);
      const targetScale = mix(0.2, 1.0, regrow);
      const scaleHere = mix(1.0, targetScale, near);
      biteScale = min(biteScale, scaleHere);
    }

    const aboveGround = positionLocal.y.sub(groundY);
    const newAboveGround = aboveGround.mul(biteScale);
    const newY = groundY.add(newAboveGround);

    const displaced = (vec3 as any)(
      positionLocal.x.add(wind).add(hPushX),
      newY,
      positionLocal.z.add(hPushZ)
    );

    const material = new MeshBasicNodeMaterial();
    (material as any).colorNode = colorNode;
    (material as any).positionNode = displaced;
    material.side = DoubleSide;

    this.mesh = new InstancedMesh(geo, material, this.bladesPerChunk);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
  }

  regenerate(cx: number, cz: number) {
    this.originX = cx;
    this.originZ = cz;
    const dummy = new Object3D();

    for (let i = 0; i < this.bladesPerChunk; i++) {
      const lx = (Math.random() - 0.5) * CHUNK_SIZE;
      const lz = (Math.random() - 0.5) * CHUNK_SIZE;
      const x = cx + lx;
      const z = cz + lz;
      const y = heightAt(x, z);
      dummy.position.set(x, y, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.rotation.x = (Math.random() - 0.5) * 0.3;
      const s = 0.5 + Math.random() * 0.7;
      dummy.scale.set(1, s, 1);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(time: number) {
    this.timeNode.value = time;
  }

  setHorsePos(x: number, z: number) {
    this.horsePosNode.value.set(x, 0, z);
  }

  addBitePoint(x: number, z: number, time: number) {
    const idx = this.biteWriteIndex % BITE_CAPACITY;
    this.bitePosXZNodes[idx].value.set(x, z);
    this.biteTimeNodes[idx].value = time;
    this.biteWriteIndex++;
  }
}

export class GrassSystem {
  chunks: GrassChunk[] = [];
  gridSize = 7;
  chunkSize = CHUNK_SIZE;
  bladesPerChunk = 5000;
  bladeSegments = 1;

  constructor(qualityPreset?: QualityPreset) {
    if (qualityPreset) {
      this.gridSize = qualityPreset.grassChunkRadius;
      this.bladesPerChunk = qualityPreset.grassBladesPerChunk;
      this.bladeSegments = qualityPreset.bladeSegments;
    }
    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
      this.chunks.push(new GrassChunk(this.bladesPerChunk));
    }
    this.initChunks(0, 0);
  }

  initChunks(cx: number, cz: number) {
    const range = Math.floor(this.gridSize / 2);
    let idx = 0;
    for (let dz = -range; dz <= range; dz++) {
      for (let dx = -range; dx <= range; dx++) {
        this.chunks[idx].regenerate(cx + dx * this.chunkSize, cz + dz * this.chunkSize);
        idx++;
      }
    }
  }

  addTo(scene: any) {
    for (const c of this.chunks) scene.add(c.mesh);
  }

  removeFrom(scene: any) {
    for (const c of this.chunks) scene.remove(c.mesh);
  }

  destroy() {
    for (const c of this.chunks) {
      c.mesh.removeFromParent?.();
      c.mesh.geometry.dispose();
      (c.mesh.material as any).dispose?.();
    }
    this.chunks = [];
  }

  setWindStrength(v: number) {
    for (const c of this.chunks) {
      c.windStrengthNode.value = v;
    }
  }

  setWetness(v: number) {
    for (const c of this.chunks) {
      c.wetnessNode.value = v;
    }
  }

  reconfigure(q: QualityPreset, scene: any) {
    this.removeFrom(scene);
    this.destroy();
    this.gridSize = q.grassChunkRadius;
    this.bladesPerChunk = q.grassBladesPerChunk;
    this.bladeSegments = q.bladeSegments;
    for (let i = 0; i < this.gridSize * this.gridSize; i++) {
      this.chunks.push(new GrassChunk(this.bladesPerChunk));
    }
    this.initChunks(0, 0);
    this.addTo(scene);
  }

  update(cameraPos: Vector3) {
    const range = Math.floor(this.gridSize / 2);
    const cx = Math.floor(cameraPos.x / this.chunkSize) * this.chunkSize;
    const cz = Math.floor(cameraPos.z / this.chunkSize) * this.chunkSize;

    const t = performance.now() / 1000;
    const targets: Array<{ x: number; z: number; key: string }> = [];
    const targetKeys = new Set<string>();
    for (let dz = -range; dz <= range; dz++) {
      for (let dx = -range; dx <= range; dx++) {
        const x = cx + dx * this.chunkSize;
        const z = cz + dz * this.chunkSize;
        const key = `${x},${z}`;
        targets.push({ x, z, key });
        targetKeys.add(key);
      }
    }

    const chunksByOrigin = new Map<string, GrassChunk>();
    const recyclable: GrassChunk[] = [];
    for (const chunk of this.chunks) {
      const key = `${chunk.originX},${chunk.originZ}`;
      if (targetKeys.has(key) && !chunksByOrigin.has(key)) {
        chunksByOrigin.set(key, chunk);
      } else {
        recyclable.push(chunk);
      }
    }

    for (const target of targets) {
      let chunk = chunksByOrigin.get(target.key);
      if (!chunk) {
        chunk = recyclable.pop();
        if (chunk) chunk.regenerate(target.x, target.z);
      }
      chunk?.update(t);
    }
  }

  setHorsePos(x: number, z: number) {
    for (const c of this.chunks) c.setHorsePos(x, z);
  }

  addBitePoint(x: number, z: number) {
    const time = performance.now() / 1000;
    for (const c of this.chunks) c.addBitePoint(x, z, time);
  }
}
