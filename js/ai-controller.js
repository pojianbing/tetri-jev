/**
 * ai-controller.js - AI 自动驾驶控制器 (支持单人与对战模式)
 * 严格只依靠 TypeSafe 云端 Jev 进行真实落点判断。未配置 Key 时禁止自动游玩。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const CandidateEvaluator = require('./candidate.js');
    const JevClient = require('./jev-client.js');
    module.exports = factory(CandidateEvaluator, JevClient);
  } else {
    root.AIController = factory(root.CandidateEvaluator, root.JevClient);
  }
})(typeof self !== 'undefined' ? self : this, function (CandidateEvaluator, JevClient) {
  'use strict';

  class AIController {
    constructor(game, options = {}) {
      this.game = game;
      this.opponentGame = options.opponentGame || null;
      this.jevClient = options.jevClient || new JevClient.TypeSafeJevClient();
      this.isEnabled = false;
      this.isThinking = false;
      this.actionQueue = [];
      this.speedMode = 'normal'; // 'slow', 'normal', 'fast'
      this.stepInterval = 45; // 动作执行间隔 (ms)
      this.timerId = null;

      // 观察者回调
      this.onDecisionMade = options.onDecisionMade || null;
      this.onStatusChange = options.onStatusChange || null;
      this.onError = options.onError || null;
    }

    setGame(game) {
      this.game = game;
      this.actionQueue = [];
      this.isThinking = false;
    }

    setOpponent(opponentGame) {
      this.opponentGame = opponentGame;
    }

    setEnabled(enabled) {
      this.isEnabled = enabled;
      this.actionQueue = [];
      if (!this.isEnabled && this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      if (this.onStatusChange) {
        this.onStatusChange(this.isEnabled);
      }
    }

    setSpeed(speed) {
      this.speedMode = speed;
      if (speed === 'slow') {
        this.stepInterval = 120;
      } else if (speed === 'normal') {
        this.stepInterval = 45;
      } else if (speed === 'fast') {
        this.stepInterval = 10;
      }
    }

    /**
     * 周期性检查与推进
     */
    async update() {
      if (!this.isEnabled || this.game.gameOver || this.game.isPaused) {
        return;
      }

      // 如果队列中有待执行动作，优先执行队列
      if (this.actionQueue.length > 0) {
        const action = this.actionQueue.shift();
        this.executeAction(action);
        return;
      }

      // 如果当前没有方块，等待游戏生成
      if (!this.game.currentPiece) {
        return;
      }

      // 开始进行 Jev 云端决策
      if (!this.isThinking) {
        await this.thinkAndPlan();
      }
    }

    /**
     * 向 TypeSafe 官方云端发起 Jev 决策并规划动作
     */
    async thinkAndPlan() {
      this.isThinking = true;
      try {
        const game = this.game;
        const currentPiece = game.currentPiece;
        if (!currentPiece) {
          this.isThinking = false;
          return;
        }

        // 1. 挑选合法候选落点（支持传入对手游戏感知）
        const topCandidates = CandidateEvaluator.selectTopCandidatesForJev(game, 4, this.opponentGame);
        if (topCandidates.length === 0) {
          this.game.tick();
          this.isThinking = false;
          return;
        }

        // 2. 打包成 TypeSafe Jev 规范的 State 与 Questions
        const { state, criteria, candidates } = CandidateEvaluator.formatStateForJev(game, topCandidates, this.opponentGame);

        const isBattle = Boolean(this.opponentGame);
        const instructionsText = isBattle
          ? 'In this competitive Tetris battle, which candidate placement best balances offensive garbage-sending with defensive line-clearing to survive and defeat the opponent?'
          : 'Which candidate placement is the safest and most strategic for long-term survival in Tetris, minimizing created holes and maintaining a flat board?';

        const questions = {
          best_placement: {
            type: 'choice',
            instructions: instructionsText,
            criteria,
          },
          board_risk: {
            type: 'score',
            instructions: 'Evaluate overall board risk based on stack height and incoming garbage lines',
            criteria: [
              'Low risk (stack is low and well-controlled)',
              'Medium risk (elevated stack height or isolated gap)',
              'High risk (critical top-out danger, immediate clearance needed)',
            ],
          },
        };

        // 3. 严格请求真实云端 Jev 模型
        const evalResult = await this.jevClient.evaluate(state, questions);

        // 4. 读取 Jev 真实选定的落点
        if (!evalResult.answers || !evalResult.answers.best_placement) {
          throw new Error('Jev API 未返回合法的 best_placement 结果');
        }

        const chosenId = evalResult.answers.best_placement.choice;
        const targetPlacement = candidates.find((c) => c.id === chosenId) || candidates[0];

        // 5. 规划物理操作队列
        this.planMovement(currentPiece, targetPlacement);

        // 6. 回调通知 UI 渲染仪表盘
        if (this.onDecisionMade) {
          this.onDecisionMade({
            state,
            questions,
            evalResult,
            chosenCandidate: targetPlacement,
            candidates,
          });
        }
      } catch (err) {
        console.error('Jev 决策调用失败:', err.message);
        this.setEnabled(false);
        if (this.onError) {
          this.onError(err);
        }
      } finally {
        this.isThinking = false;
      }
    }

    /**
     * 将目标落点分解为具体的旋转和移动序列
     */
    planMovement(currentPiece, targetPlacement) {
      const actions = [];

      // 1. 旋转对齐
      let rotCount = (targetPlacement.rotation - currentPiece.rotation + 4) % 4;
      for (let i = 0; i < rotCount; i++) {
        actions.push('rotate');
      }

      // 2. 横向移动对齐
      const diffX = targetPlacement.x - currentPiece.x;
      if (diffX < 0) {
        for (let i = 0; i < Math.abs(diffX); i++) {
          actions.push('left');
        }
      } else if (diffX > 0) {
        for (let i = 0; i < diffX; i++) {
          actions.push('right');
        }
      }

      // 3. 硬降锁定
      actions.push('hardDrop');

      this.actionQueue = actions;
    }

    /**
     * 执行单步物理动作
     */
    executeAction(action) {
      if (this.game.gameOver || this.game.isPaused) return;

      switch (action) {
        case 'rotate':
          this.game.rotate(true);
          break;
        case 'left':
          this.game.moveLeft();
          break;
        case 'right':
          this.game.moveRight();
          break;
        case 'softDrop':
          this.game.softDrop();
          break;
        case 'hardDrop':
          this.game.hardDrop();
          break;
        default:
          break;
      }
    }
  }

  return {
    AIController,
  };
});
