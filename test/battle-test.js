const Tetris = require('../js/tetris.js');
const BattleManager = require('../js/battle-manager.js');

console.log('--- Testing Battle Manager ---');
const battle = new BattleManager.BattleManager();

// 1. 验证发牌同步
const humanPiece1 = battle.humanGame.currentPiece.type;
const jevPiece1 = battle.jevGame.currentPiece.type;
console.log(`Initial Piece Check: Human=${humanPiece1}, Jev=${jevPiece1}`);
if (humanPiece1 !== jevPiece1) {
  throw new Error('Initial pieces do not match!');
}

const humanNext = battle.humanGame.nextPiece;
const jevNext = battle.jevGame.nextPiece;
console.log(`Next Piece Check: Human=${humanNext}, Jev=${jevNext}`);
if (humanNext !== jevNext) {
  throw new Error('Next pieces do not match!');
}

// 2. 模拟攻击传输
battle.handleAttack('human', 'jev', 2);
console.log(`Jev Pending Garbage after 2 lines attack: ${battle.jevGame.pendingGarbage}`);
if (battle.jevGame.pendingGarbage !== 2) {
  throw new Error('Garbage transfer failed!');
}

// 3. 模拟顶死胜负
battle.handleTopOut('human');
console.log(`Scores after Human KO: Human=${battle.humanWins}, Jev=${battle.jevWins}`);
if (battle.jevWins !== 1) {
  throw new Error('Top-out arbitration failed!');
}

console.log('Battle Manager Test PASSED!');
