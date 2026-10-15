import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  type WebGPURenderer,
  type Scene,
} from 'three/webgpu';
import { BOARD_CHUNK_SIZE, BOARD_REGION_SIZE, BOARD_SPAWN_AHEAD_CHUNKS } from '../config/boards';
import type { Message } from '../data/messages';
import { heightAt } from './terrain';
import { createBoardTexture } from './boardTexture';
import { boardSpawnChunk, isInsideBoardRegion, orderBoardMessages, placeBoardAtChunk, selectBoardMessage, shouldSpawnNextBoard, type BoardPlacement } from './boards';
import type { GrassSystem } from './grass';

type LoadedBoard = {
  placement: BoardPlacement;
  root: Group;
  wood: MeshStandardMaterial;
  panel: MeshStandardMaterial;
  texture: ReturnType<typeof createBoardTexture>;
};

const WOOD_COLOR = 0x493323;
const PANEL_EMISSIVE_DAY = 0.35;
const PANEL_EMISSIVE_NIGHT = 0.8;

export class MessageBoards {
  readonly placements: Message[];
  private readonly loaded = new Map<number, LoadedBoard>();
  private readonly collected = new Set<number>();
  private lastChunk = '';
  private anchorChunkX: number | null = null;
  private anchorChunkZ: number | null = null;
  private activeEntered = false;
  activePlacement: BoardPlacement | null = null;
  private night = false;
  private wetness = 0;

  get loadedCount() {
    return this.loaded.size;
  }

  constructor(
    private readonly scene: Scene,
    private readonly grass: GrassSystem,
    private readonly renderer: WebGPURenderer,
    seed: number,
    messages: Message[],
    private readonly onEnterChunk: (placement: BoardPlacement) => void,
    private readonly nearMessageId?: number,
  ) {
    this.placements = orderBoardMessages(seed, messages);
    this.logLayout(nearMessageId !== undefined);
  }

  update(x: number, z: number, yaw: number) {
    const chunkX = Math.floor(x / BOARD_CHUNK_SIZE);
    const chunkZ = Math.floor(z / BOARD_CHUNK_SIZE);
    const key = `${chunkX},${chunkZ}`;
    if (key === this.lastChunk) return false;
    this.lastChunk = key;

    if (this.anchorChunkX === null || this.anchorChunkZ === null) {
      this.anchorChunkX = chunkX;
      this.anchorChunkZ = chunkZ;
      if (this.nearMessageId !== undefined) this.spawnAt(x, z, yaw, this.nearMessageId);
    }

    if (this.activePlacement && this.activeEntered && this.collected.has(this.activePlacement.id)) {
      this.anchorChunkX = this.activePlacement.chunkX;
      this.anchorChunkZ = this.activePlacement.chunkZ;
    }
    const outsideSquare = !isInsideBoardRegion(chunkX, chunkZ, this.anchorChunkX, this.anchorChunkZ);
    if (shouldSpawnNextBoard(outsideSquare, this.activePlacement, this.collected, this.activeEntered)) {
      this.clearActiveBoard();
      this.spawnAt(x, z, yaw);
    }

    const board = this.activePlacement && `${this.activePlacement.chunkX},${this.activePlacement.chunkZ}` === key
      ? this.activePlacement
      : null;
    if (board) {
      this.activeEntered = true;
      if (this.collected.has(board.id)) {
        this.anchorChunkX = board.chunkX;
        this.anchorChunkZ = board.chunkZ;
      } else this.onEnterChunk(board);
    }

    if (this.activePlacement && !this.loaded.has(this.activePlacement.id)) this.load(this.activePlacement);

    return true;
  }

  setCollected(ids: Iterable<number>) {
    this.collected.clear();
    for (const id of ids) this.collected.add(id);
    for (const board of this.loaded.values()) this.refreshTexture(board);
    if (this.activePlacement && this.activeEntered && this.collected.has(this.activePlacement.id)) {
      this.anchorChunkX = this.activePlacement.chunkX;
      this.anchorChunkZ = this.activePlacement.chunkZ;
    } else if (this.activePlacement && !this.collected.has(this.activePlacement.id)) {
      this.activeEntered = false;
    }
  }

  setNight(night: boolean) {
    this.night = night;
    for (const board of this.loaded.values()) board.panel.emissiveIntensity = night ? PANEL_EMISSIVE_NIGHT : PANEL_EMISSIVE_DAY;
  }

  setWetness(wetness: number) {
    if (this.wetness === wetness) return;
    this.wetness = wetness;
    const shade = 1 - wetness * 0.24;
    for (const board of this.loaded.values()) board.wood.color.setHex(WOOD_COLOR).multiplyScalar(shade);
  }

  destroy() {
    for (const id of [...this.loaded.keys()]) this.unload(id);
    this.grass.setBoardExclusions([]);
  }

  private spawnAt(horseX: number, horseZ: number, yaw: number, messageId?: number) {
    const source = this.placements.find((message) => message.id === messageId)
      ?? selectBoardMessage(this.placements, this.collected);
    if (!source) return;
    const chunk = boardSpawnChunk(horseX, horseZ, yaw);
    this.activePlacement = placeBoardAtChunk(source, chunk.chunkX, chunk.chunkZ, horseX, horseZ);
    this.activeEntered = false;
  }

  private clearActiveBoard() {
    if (this.activePlacement) this.unload(this.activePlacement.id);
    this.activePlacement = null;
    this.activeEntered = false;
  }

  private load(placement: BoardPlacement) {
    const root = new Group();
    root.position.set(placement.x, heightAt(placement.x, placement.z), placement.z);
    root.rotation.y = placement.yaw;

    const wood = new MeshStandardMaterial({ color: WOOD_COLOR, roughness: 0.92 });
    const panel = new MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: this.night ? PANEL_EMISSIVE_NIGHT : PANEL_EMISSIVE_DAY,
      roughness: 0.88,
      side: DoubleSide,
    });
    const postGeometry = new BoxGeometry(0.2, 2.6, 0.2);
    const frameGeometry = new BoxGeometry(4, 2.3, 0.15);
    const bannerGeometry = new BoxGeometry(4, 0.35, 0.22);
    for (const x of [-1.6, 1.6]) {
      const post = new Mesh(postGeometry, wood);
      post.position.set(x, 1.3, 0);
      post.castShadow = true;
      post.receiveShadow = true;
      root.add(post);
    }
    const frame = new Mesh(frameGeometry, wood);
    frame.position.y = 2.05;
    frame.castShadow = true;
    frame.receiveShadow = true;
    root.add(frame);

    const banner = new Mesh(bannerGeometry, wood);
    banner.position.set(0, 3.325, 0);
    banner.castShadow = true;
    root.add(banner);

    const texture = createBoardTexture(placement.id, placement.text, this.renderer.getMaxAnisotropy(), this.collected.has(placement.id));
    panel.map = texture;
    panel.emissiveMap = texture;
    const textPanel = new Mesh(new PlaneGeometry(3.6, 1.9), panel);
    textPanel.position.set(0, 2.05, 0.086);
    textPanel.castShadow = false;
    textPanel.receiveShadow = false;
    root.add(textPanel);

    const shade = 1 - this.wetness * 0.24;
    wood.color.setHex(WOOD_COLOR).multiplyScalar(shade);
    this.scene.add(root);
    this.loaded.set(placement.id, { placement, root, wood, panel, texture });
    this.grass.setBoardExclusions([...this.loaded.values()].map(({ placement: loaded }) => ({ x: loaded.x, z: loaded.z })));
  }

  private refreshTexture(board: LoadedBoard) {
    board.texture.dispose();
    board.texture = createBoardTexture(
      board.placement.id,
      board.placement.text,
      this.renderer.getMaxAnisotropy(),
      this.collected.has(board.placement.id),
    );
    board.panel.map = board.texture;
    board.panel.emissiveMap = board.texture;
    board.panel.needsUpdate = true;
  }

  private unload(id: number) {
    const board = this.loaded.get(id);
    if (!board) return;
    this.scene.remove(board.root);
    const geometries = new Set<BufferGeometry>();
    board.root.traverse((object) => { if (object instanceof Mesh) geometries.add(object.geometry); });
    for (const geometry of geometries) geometry.dispose();
    board.texture.dispose();
    board.panel.dispose();
    board.wood.dispose();
    this.loaded.delete(id);
    this.grass.setBoardExclusions([...this.loaded.values()].map(({ placement }) => ({ x: placement.x, z: placement.z })));
  }

  private logLayout(nearSpawnBoard: boolean) {
    if (!this.placements.length) {
      console.info('Boards: no active messages are available.');
      return;
    }
    console.info(nearSpawnBoard
      ? `Boards: ${this.placements.length}; development near-spawn board enabled.`
      : `Boards: ${this.placements.length}; chunk size ${BOARD_CHUNK_SIZE} m; after reaching a board, the next spawns ${BOARD_SPAWN_AHEAD_CHUNKS} chunks ahead when the horse exits its ${BOARD_REGION_SIZE}×${BOARD_REGION_SIZE}-chunk square.`);
  }
}
