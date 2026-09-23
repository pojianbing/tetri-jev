const Tetris = require('../js/tetris.js');
const CandidateEvaluator = require('../js/candidate.js');
const JevClient = require('../js/jev-client.js');
const AIController = require('../js/ai-controller.js');

async function runEndToEndSimulation() {
  console.log('--- Starting 20-Piece Auto-Play Simulation ---');
  const game = new Tetris.TetrisGame();
  const jevClient = new JevClient.TypeSafeJevClient();
  const ai = new AIController.AIController(game, { jevClient });
  ai.setEnabled(true);

  let piecesPlayed = 0;
  const maxPieces = 20;

  while (piecesPlayed < maxPieces && !game.gameOver) {
    const curType = game.currentPiece ? game.currentPiece.type : 'none';
    await ai.thinkAndPlan();

    while (ai.actionQueue.length > 0) {
      const act = ai.actionQueue.shift();
      ai.executeAction(act);
    }

    piecesPlayed++;
    const heights = CandidateEvaluator.getColumnHeights(game.grid, game.cols, game.rows);
    const maxHeight = Math.max(...heights, 0);
    const holes = CandidateEvaluator.countHoles(game.grid, game.cols, game.rows);

    console.log(
      `Piece ${piecesPlayed} (${curType}) placed. Score: ${game.score}, Lines: ${game.lines}, MaxHeight: ${maxHeight}, Holes: ${holes}`
    );
  }

  console.log('--- Simulation Finished ---');
  console.log(`Total Pieces: ${piecesPlayed}`);
  console.log(`Final Score: ${game.score}`);
  console.log(`Lines Cleared: ${game.lines}`);
  console.log(`Game Over: ${game.gameOver}`);
}

runEndToEndSimulation();
