import { BOARD_CHUNK_SIZE, BOARD_REGION_SIZE, BOARD_SPAWN_AHEAD_CHUNKS } from '../config/boards';
import type { Message } from '../data/messages';

export type BoardPlacement = Message & {
  chunkX: number;
  chunkZ: number;
  x: number;
  z: number;
  yaw: number;
};

function mulberry32(a: number) {
  return () => {
    a |= 0x0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function orderBoardMessages(seed: number, messages: Message[]) {
  const ordered = [...messages].sort((a, b) => a.id - b.id);
  const random = mulberry32(seed >>> 0);
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  return ordered;
}

export function selectBoardMessage(messages: Message[], collected: Set<number>, random = Math.random) {
  const undiscovered = messages.find((message) => !collected.has(message.id));
  if (undiscovered || !messages.length) return undiscovered;
  return messages[Math.floor(random() * messages.length)];
}

export function canReplaceActiveBoard(active: BoardPlacement | null, collected: Set<number>) {
  return !active || collected.has(active.id);
}

export function shouldSpawnNextBoard(outsideRegion: boolean, active: BoardPlacement | null, collected: Set<number>, entered: boolean) {
  return outsideRegion && canReplaceActiveBoard(active, collected) && (!active || entered);
}

export function isInsideBoardRegion(chunkX: number, chunkZ: number, centerX: number, centerZ: number) {
  const half = BOARD_REGION_SIZE / 2;
  return chunkX >= centerX - half && chunkX < centerX + half
    && chunkZ >= centerZ - half && chunkZ < centerZ + half;
}

export function boardSpawnChunk(x: number, z: number, yaw: number) {
  const worldX = x + Math.sin(yaw) * BOARD_CHUNK_SIZE * BOARD_SPAWN_AHEAD_CHUNKS;
  const worldZ = z + Math.cos(yaw) * BOARD_CHUNK_SIZE * BOARD_SPAWN_AHEAD_CHUNKS;
  return {
    chunkX: Math.floor(worldX / BOARD_CHUNK_SIZE),
    chunkZ: Math.floor(worldZ / BOARD_CHUNK_SIZE),
  };
}

export function placeBoardAtChunk(message: Message, chunkX: number, chunkZ: number, horseX: number, horseZ: number): BoardPlacement {
  const x = (chunkX + 0.5) * BOARD_CHUNK_SIZE;
  const z = (chunkZ + 0.5) * BOARD_CHUNK_SIZE;
  return { ...message, chunkX, chunkZ, x, z, yaw: Math.atan2(horseX - x, horseZ - z) };
}
