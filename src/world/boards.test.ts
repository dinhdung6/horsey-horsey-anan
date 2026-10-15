import { boardSpawnChunk, canReplaceActiveBoard, isInsideBoardRegion, orderBoardMessages, placeBoardAtChunk, selectBoardMessage, shouldSpawnNextBoard } from './boards';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const messages = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, text: `message ${i + 1}` }));

for (let seed = 0; seed < 1000; seed++) {
  const ordered = orderBoardMessages(seed, messages);
  assert(JSON.stringify(ordered) === JSON.stringify(orderBoardMessages(seed, messages)), `seed ${seed}: order is not deterministic`);
  assert(ordered.length === messages.length, `seed ${seed}: message count mismatch`);
  assert(new Set(ordered.map((message) => message.id)).size === messages.length, `seed ${seed}: duplicate message`);
}

assert(orderBoardMessages(1, []).length === 0, 'empty messages should create no boards');
assert(selectBoardMessage(messages, new Set([1]))?.id !== 1, 'undiscovered messages must be selected before repeats');
assert(selectBoardMessage(messages.slice(0, 2), new Set([1, 2]), () => 0.75)?.id === 2, 'fully discovered messages should be selected randomly');
assert(selectBoardMessage([], new Set()) === undefined, 'no messages should produce no board');
assert(isInsideBoardRegion(5, -10, 10, -5), 'the lower edge of the centered 10×10 square should be inside');
assert(isInsideBoardRegion(14, -1, 10, -5), 'the upper edge of the centered 10×10 square should be inside');
assert(!isInsideBoardRegion(15, -5, 10, -5), 'leaving the centered 10×10 square should trigger the next spawn');
assert(!isInsideBoardRegion(10, 5, 10, -5), 'leaving the square on either axis should count as exit');
const dynamic = placeBoardAtChunk(messages[0], -2, 6, -25, 104);
assert(dynamic.chunkX === -2 && dynamic.chunkZ === 6 && dynamic.x === -24 && dynamic.z === 104, 'dynamic board should use the horse chunk center');
assert(dynamic.yaw === -Math.PI / 2, 'dynamic board should face the horse');
assert(!canReplaceActiveBoard(dynamic, new Set()), 'an undiscovered board must stay until the horse reaches it');
assert(canReplaceActiveBoard(dynamic, new Set([dynamic.id])), 'a discovered board can be replaced');
assert(!shouldSpawnNextBoard(true, dynamic, new Set(), true), 'an undiscovered board must stay even after leaving the square');
assert(!shouldSpawnNextBoard(true, dynamic, new Set([dynamic.id]), false), 'a discovered board must be reached before the next spawn');
assert(shouldSpawnNextBoard(true, dynamic, new Set([dynamic.id]), true), 'leaving the square after discovery should spawn the next board');
assert(!shouldSpawnNextBoard(false, dynamic, new Set([dynamic.id]), true), 'staying inside the square should not spawn another board');
const northSpawn = boardSpawnChunk(0, 0, 0);
assert(northSpawn.chunkX === 0 && northSpawn.chunkZ === 3, 'a north-facing horse should spawn the board three chunks ahead');
const eastSpawn = boardSpawnChunk(0, 0, Math.PI / 2);
assert(eastSpawn.chunkX === 3 && eastSpawn.chunkZ === 0, 'an east-facing horse should spawn the board three chunks ahead');
console.info('Board placement checks passed for 1,000 seeds.');
