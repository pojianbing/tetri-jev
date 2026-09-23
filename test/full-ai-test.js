const assert = require('assert');
const Tetris = require('../js/tetris.js');
const CandidateEvaluator = require('../js/candidate.js');
const AIController = require('../js/ai-controller.js');

console.log('--- Testing Full AI Freedom (Zero Pruning Mode) ---');

const game = new Tetris.TetrisGame(10, 20);

// 1. 测试标准 top4 模式
const top4Candidates = CandidateEvaluator.selectCandidatesForJev(game, { mode: 'top4', maxCandidates: 4 });
assert.strictEqual(top4Candidates.length, 4, 'top4 模式应恰好返回 4 个候选');
console.log('✓ top4 精炼推荐模式验证通过：返回 4 个最优落点');

// 2. 测试 full 全息自由模式 (零预裁减)
const fullCandidates = CandidateEvaluator.selectCandidatesForJev(game, { mode: 'full' });
console.log(`当前方块 [${game.currentPiece.type}] 的全部合法落点数量: ${fullCandidates.length}`);
// 俄罗斯方块中任何方块在空白 10x20 棋盘上的合法落点数量在 9 到 34 之间
assert.ok(fullCandidates.length >= 9 && fullCandidates.length <= 34, '全部合法落点数量应在 9~34 之间');
assert.ok(fullCandidates.length >= top4Candidates.length, '全息模式候选数必须大于等于 top4 候选数');
console.log('✓ full 全息自由模式验证通过：完整返回全局合法落点，零预先剔除');

// 3. 测试 7 种方块在 full 模式下的合法落点完整性
const pieceTypes = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
pieceTypes.forEach(type => {
  const customPieceGame = new Tetris.TetrisGame(10, 20);
  customPieceGame.currentPiece = customPieceGame.spawnPiece(type);
  const cand = CandidateEvaluator.selectCandidatesForJev(customPieceGame, { mode: 'full' });
  assert.ok(cand.length > 0, `方块 ${type} 应成功枚举所有合法落点`);
});
console.log('✓ 全部 7 种方块 (I/J/L/O/S/T/Z) 全量候选枚举验证通过');

// 4. 测试打包格式化为 System One JSON
const payload = CandidateEvaluator.formatStateForJev(game, fullCandidates);
const candidateKeys = Object.keys(payload.state.candidate_options);
assert.strictEqual(candidateKeys.length, fullCandidates.length, 'JSON 中的 candidate_options 数量应与 full 候选数完全一致');
assert.strictEqual(Object.keys(payload.criteria).length, fullCandidates.length, 'JSON 中的 criteria 数量应与 full 候选数完全一致');
assert.ok(candidateKeys.includes('placement_1'), '应包含 placement_1');
assert.ok(candidateKeys.includes(`placement_${fullCandidates.length}`), `应包含末尾选项 placement_${fullCandidates.length}`);
console.log(`✓ System One 协议封包验证通过：成功将全部 ${fullCandidates.length} 个落点完整打包为 placement_1 ~ placement_${fullCandidates.length}`);

// 5. 测试 AIController 模式切换
const ai = new AIController.AIController(game, { candidateMode: 'top4' });
assert.strictEqual(ai.candidateMode, 'top4');
ai.setCandidateMode('full');
assert.strictEqual(ai.candidateMode, 'full');
ai.setCandidateMode('top4');
assert.strictEqual(ai.candidateMode, 'top4');
console.log('✓ AIController 动态模式切换验证通过');

console.log('All Full AI Freedom Tests PASSED!');
