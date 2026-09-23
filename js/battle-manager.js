/**
 * battle-manager.js - 人机对战裁决与调度中枢
 * 管理 Human 与 Jev 的镜像发牌同步、垃圾行攻击传输、伤害抵消与胜负判定。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Tetris = require('./tetris.js');
    module.exports = factory(Tetris);
  } else {
    root.BattleManager = factory(root.Tetris);
  }
})(typeof self !== 'undefined' ? self : this, function (Tetris) {
  'use strict';

  class BattleManager {
    constructor(options = {}) {
      this.humanWins = 0;
      this.jevWins = 0;
      this.round = 1;
      this.isRoundOver = false;

      // 观察者回调
      this.onAttackEvent = options.onAttackEvent || null; // (from: 'human'|'jev', to: 'human'|'jev', lines)
      this.onRoundEnd = options.onRoundEnd || null; // (winner: 'human'|'jev', reason)
      this.onScoreUpdate = options.onScoreUpdate || null;

      this.initRound();
    }

    /**
     * 开始新的一局对战（重置盘面与同步随机种子）
     */
    initRound() {
      this.isRoundOver = false;
      // 双方共享同一个随机种子发牌流
      const roundSeed = Math.floor(Math.random() * 10000000) + 1;
      this.pieceStream = new Tetris.SynchronizedPieceStream(roundSeed);

      // 1. 初始化人类玩家游戏
      this.humanGame = new Tetris.TetrisGame(10, 20, {
        pieceStream: this.pieceStream,
        onAttack: (lines) => {
          this.handleAttack('human', 'jev', lines);
        },
        onTopOut: () => {
          this.handleTopOut('human');
        },
      });

      // 2. 初始化 Jev AI 游戏
      this.jevGame = new Tetris.TetrisGame(10, 20, {
        pieceStream: this.pieceStream,
        onAttack: (lines) => {
          this.handleAttack('jev', 'human', lines);
        },
        onTopOut: () => {
          this.handleTopOut('jev');
        },
      });
    }

    handleAttack(from, to, lines) {
      if (this.isRoundOver) return;

      const targetGame = to === 'human' ? this.humanGame : this.jevGame;
      targetGame.addPendingGarbage(lines);

      if (this.onAttackEvent) {
        this.onAttackEvent({
          from,
          to,
          lines,
          pendingTotal: targetGame.pendingGarbage,
        });
      }
    }

    handleTopOut(loser) {
      if (this.isRoundOver) return;
      this.isRoundOver = true;

      const winner = loser === 'human' ? 'jev' : 'human';
      if (winner === 'human') {
        this.humanWins++;
      } else {
        this.jevWins++;
      }

      // 停止双方游戏
      this.humanGame.gameOver = true;
      this.jevGame.gameOver = true;

      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          humanWins: this.humanWins,
          jevWins: this.jevWins,
          round: this.round,
        });
      }

      if (this.onRoundEnd) {
        this.onRoundEnd({
          winner,
          loser,
          round: this.round,
          humanScore: this.humanGame.score,
          jevScore: this.jevGame.score,
        });
      }
    }

    nextRound() {
      this.round++;
      this.initRound();
    }

    resetMatch() {
      this.humanWins = 0;
      this.jevWins = 0;
      this.round = 1;
      this.initRound();
      if (this.onScoreUpdate) {
        this.onScoreUpdate({
          humanWins: 0,
          jevWins: 0,
          round: 1,
        });
      }
    }
  }

  return {
    BattleManager,
  };
});
