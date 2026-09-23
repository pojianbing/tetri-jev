const Tetris = require('../js/tetris.js');
const CandidateEvaluator = require('../js/candidate.js');

const game = new Tetris.TetrisGame();
console.log('Game initialized.');
console.log('Current piece:', game.currentPiece.type);
console.log('Next piece:', game.nextPiece);

const legalPlacements = CandidateEvaluator.getAllLegalPlacements(game);
console.log(`Found ${legalPlacements.length} legal placements for ${game.currentPiece.type}.`);

const topCandidates = CandidateEvaluator.selectTopCandidatesForJev(game, 4);
console.log(`Top ${topCandidates.length} candidates selected.`);

const jevPayload = CandidateEvaluator.formatStateForJev(game, topCandidates);
console.log('Jev State JSON:');
console.log(JSON.stringify(jevPayload.state, null, 2));
console.log('Jev Criteria:');
console.log(JSON.stringify(jevPayload.criteria, null, 2));

console.log('Test PASSED!');
