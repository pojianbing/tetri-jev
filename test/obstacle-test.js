const assert = require('assert');
const Tetris = require('../js/tetris.js');
const CandidateEvaluator = require('../js/candidate.js');

console.log('--- Testing Obstacle Live Injection & Clearance ---');

const game = new Tetris.TetrisGame(10, 20);

// 1. 测试单人模式注入 1 行障碍
assert.strictEqual(game.gameOver, false);
game.injectGarbage(1);

// 底部最后一行应该包含 9 个 'G' 和 1 个 0 (缺口)
const bottomRow = game.grid[19];
const gCount = bottomRow.filter(cell => cell === 'G').length;
const emptyCount = bottomRow.filter(cell => cell === 0).length;
assert.strictEqual(gCount, 9, '底部行应包含9个G障碍块');
assert.strictEqual(emptyCount, 1, '底部行应包含1个空洞缺口');
console.log('✓ 1行障碍注入验证通过：底层具有9个G与1个缺口');

// 2. 测试连续注入 2 行与 4 行障碍
game.injectGarbage(2);
game.injectGarbage(4);
// 总共注入 1+2+4 = 7 行
let obstacleRowsCount = 0;
for (let r = 0; r < 20; r++) {
  if (game.grid[r].some(cell => cell === 'G')) {
    obstacleRowsCount++;
  }
}
assert.strictEqual(obstacleRowsCount, 7, '盘面应累计升起7行障碍');
console.log('✓ 累计多行(+2/+4)注入验证通过：盘面存在7行障碍');

// 3. 测试候选评估算法在存在障碍物时的稳定性
const candidates = CandidateEvaluator.getAllLegalPlacements(game, game.currentPiece.type);
assert.ok(candidates.length > 0, '在存在障碍时仍应能计算出合法落点');
const topCandidates = CandidateEvaluator.selectTopCandidatesForJev(game, 4);
assert.ok(topCandidates.length > 0, '应成功生成候选候选落点');
const jevPayload = CandidateEvaluator.formatStateForJev(game, topCandidates);
assert.strictEqual(jevPayload.state.game_status.current_max_height, 7, '最大高度应感知为7');
console.log('✓ 候选评估与 AI 状态感知验证通过：AI 准确感知到地势高度与空洞');

// 4. 测试清空障碍功能
game.clearObstacles();
let hasAnyBlock = false;
for (let r = 0; r < 20; r++) {
  if (game.grid[r].some(cell => cell !== 0)) {
    hasAnyBlock = true;
    break;
  }
}
assert.strictEqual(hasAnyBlock, false, '调用 clearObstacles 后盘面网格应全部清空为0');
console.log('✓ 清空障碍验证通过：盘面网格已全部还原为空白');

// 5. 测试极限挤爆顶部触发 Game Over
game.injectGarbage(18);
assert.strictEqual(game.gameOver, false);
game.injectGarbage(5); // 超过 20 行，必然顶出
assert.strictEqual(game.gameOver, true, '障碍超出天花板应触发 Game Over');
console.log('✓ 极限压顶触发 Game Over 验证通过');

console.log('All Obstacle Tests PASSED!');
