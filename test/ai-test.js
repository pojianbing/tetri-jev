const Tetris = require('../js/tetris.js');
const CandidateEvaluator = require('../js/candidate.js');
const JevClient = require('../js/jev-client.js');
const AIController = require('../js/ai-controller.js');

async function testAI() {
  const game = new Tetris.TetrisGame();
  const jevClient = new JevClient.TypeSafeJevClient();
  const ai = new AIController.AIController(game, { jevClient });

  ai.setEnabled(true);
  console.log('AI enabled. Planning first move...');

  await ai.thinkAndPlan();
  console.log('Planned action queue:', ai.actionQueue);

  // 执行动作
  while (ai.actionQueue.length > 0) {
    const act = ai.actionQueue.shift();
    ai.executeAction(act);
  }

  console.log('Action execution finished. Current board status:');
  const heights = CandidateEvaluator.getColumnHeights(game.grid, game.cols, game.rows);
  console.log('Column heights:', heights);
  console.log('Score:', game.score);

  console.log('AI Controller Test PASSED!');
}

testAI();
