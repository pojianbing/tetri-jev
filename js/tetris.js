/**
 * tetris.js - 核心俄罗斯方块游戏引擎 (支持单人模式与对战模式)
 * 支持标准 10x20 棋盘、7种方块、碰撞检测、旋转、消行得分、幽灵方块投影、暂存及对战垃圾行收发与抵消机制。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Tetris = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 7 种标准方块定义及其 4 种旋转矩阵
  const SHAPES = {
    I: [
      [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
      [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
      [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
    ],
    J: [
      [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 1], [0, 1, 0], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 0, 1]],
      [[0, 1, 0], [0, 1, 0], [1, 1, 0]],
    ],
    L: [
      [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 0], [0, 1, 1]],
      [[0, 0, 0], [1, 1, 1], [1, 0, 0]],
      [[1, 1, 0], [0, 1, 0], [0, 1, 0]],
    ],
    O: [
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
      [[1, 1], [1, 1]],
    ],
    S: [
      [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 0, 1]],
      [[0, 0, 0], [0, 1, 1], [1, 1, 0]],
      [[1, 0, 0], [1, 1, 0], [0, 1, 0]],
    ],
    T: [
      [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
      [[0, 1, 0], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 1], [0, 1, 0]],
      [[0, 1, 0], [1, 1, 0], [0, 1, 0]],
    ],
    Z: [
      [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
      [[0, 0, 1], [0, 1, 1], [0, 1, 0]],
      [[0, 0, 0], [1, 1, 0], [0, 1, 1]],
      [[0, 1, 0], [1, 1, 0], [1, 0, 0]],
    ],
  };

  const COLORS = {
    I: '#06b6d4', // 青蓝 Cyan
    J: '#3b82f6', // 蓝 Blue
    L: '#f97316', // 橙 Orange
    O: '#eab308', // 黄 Yellow
    S: '#22c55e', // 绿 Green
    T: '#a855f7', // 紫 Purple
    Z: '#ef4444', // 红 Red
    G: '#64748b', // 垃圾行坚硬灰 Slate
  };

  const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

  /**
   * 伪随机数发生器（用于对战时种子同步）
   */
  class SeededRandom {
    constructor(seed = Date.now()) {
      this.seed = seed % 2147483647;
      if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
      this.seed = (this.seed * 16807) % 2147483647;
      return (this.seed - 1) / 2147483646;
    }
  }

  /**
   * 共享方块序列生成器（确保 Human 与 Jev 发牌 100% 镜像一致）
   */
  class SynchronizedPieceStream {
    constructor(seed = 123456) {
      this.rng = new SeededRandom(seed);
      this.sequence = [];
    }

    refill() {
      const bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng.next() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.sequence.push(...bag);
    }

    getPieceAt(index) {
      while (this.sequence.length <= index + 14) {
        this.refill();
      }
      return this.sequence[index];
    }
  }

  class TetrisGame {
    constructor(cols = 10, rows = 20, options = {}) {
      this.cols = cols;
      this.rows = rows;
      this.options = options;
      this.pieceStream = options.pieceStream || null;
      this.streamIndex = 0;

      // 对战相关回调
      this.onAttack = options.onAttack || null;
      this.onLineClear = options.onLineClear || null;
      this.onTopOut = options.onTopOut || null;

      this.reset();
    }

    reset() {
      // 棋盘数据：0 为空，或字符串（如 'I', 'T', 'G'）
      this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
      this.score = 0;
      this.lines = 0;
      this.level = 1;
      this.combo = -1;
      this.gameOver = false;
      this.isPaused = false;

      // 对战垃圾行缓冲槽 (Pending Garbage)
      this.pendingGarbage = 0;
      this.lastGarbageHoleCol = Math.floor(Math.random() * this.cols);

      this.bag = [];
      this.streamIndex = 0;
      this.currentPiece = null;
      this.nextPiece = null;
      this.holdPiece = null;
      this.canHold = true;

      if (!this.pieceStream) {
        this.refillBag();
      }
      this.spawnNextPiece();
    }

    refillBag() {
      const pieces = [...PIECE_TYPES];
      for (let i = pieces.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
      }
      this.bag.push(...pieces);
    }

    getNextPieceFromBag() {
      if (this.pieceStream) {
        const piece = this.pieceStream.getPieceAt(this.streamIndex);
        this.streamIndex++;
        return piece;
      }

      if (this.bag.length < 7) {
        this.refillBag();
      }
      return this.bag.shift();
    }

    spawnPiece(type) {
      const matrix = SHAPES[type][0];
      const x = Math.floor((this.cols - matrix[0].length) / 2);
      const y = 0;
      return {
        type,
        rotation: 0,
        matrix,
        x,
        y,
        color: COLORS[type],
      };
    }

    spawnNextPiece() {
      if (!this.nextPiece) {
        this.nextPiece = this.getNextPieceFromBag();
      }
      const type = this.nextPiece;
      this.nextPiece = this.getNextPieceFromBag();
      this.currentPiece = this.spawnPiece(type);
      this.canHold = true;

      // 产生新方块时若发生碰撞，游戏顶死结束
      if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
        this.handleTopOut();
      }
    }

    handleTopOut() {
      this.gameOver = true;
      if (this.onTopOut) {
        this.onTopOut(this);
      }
    }

    checkCollision(matrix, offsetX, offsetY, customGrid = null) {
      const grid = customGrid || this.grid;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const x = offsetX + c;
            const y = offsetY + r;
            if (x < 0 || x >= this.cols || y >= this.rows) {
              return true;
            }
            if (y >= 0 && grid[y][x] !== 0) {
              return true;
            }
          }
        }
      }
      return false;
    }

    moveLeft() {
      if (this.gameOver || this.isPaused || !this.currentPiece) return false;
      if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x - 1, this.currentPiece.y)) {
        this.currentPiece.x -= 1;
        return true;
      }
      return false;
    }

    moveRight() {
      if (this.gameOver || this.isPaused || !this.currentPiece) return false;
      if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x + 1, this.currentPiece.y)) {
        this.currentPiece.x += 1;
        return true;
      }
      return false;
    }

    rotate(clockwise = true) {
      if (this.gameOver || this.isPaused || !this.currentPiece) return false;
      const piece = this.currentPiece;
      const numRotations = SHAPES[piece.type].length;
      const nextRotation = (piece.rotation + (clockwise ? 1 : 3)) % numRotations;
      const nextMatrix = SHAPES[piece.type][nextRotation];

      const kicks = [0, 1, -1, 2, -2];
      for (let kick of kicks) {
        if (!this.checkCollision(nextMatrix, piece.x + kick, piece.y)) {
          piece.rotation = nextRotation;
          piece.matrix = nextMatrix;
          piece.x += kick;
          return true;
        }
      }
      return false;
    }

    softDrop() {
      if (this.gameOver || this.isPaused || !this.currentPiece) return false;
      if (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
        this.currentPiece.y += 1;
        this.score += 1;
        return true;
      } else {
        this.lockPiece();
        return false;
      }
    }

    hardDrop() {
      if (this.gameOver || this.isPaused || !this.currentPiece) return 0;
      let dropDistance = 0;
      while (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y + 1)) {
        this.currentPiece.y += 1;
        dropDistance++;
      }
      this.score += dropDistance * 2;
      this.lockPiece();
      return dropDistance;
    }

    hold() {
      if (this.gameOver || this.isPaused || !this.canHold || !this.currentPiece) return false;
      const currentType = this.currentPiece.type;
      if (!this.holdPiece) {
        this.holdPiece = currentType;
        this.spawnNextPiece();
      } else {
        const temp = this.holdPiece;
        this.holdPiece = currentType;
        this.currentPiece = this.spawnPiece(temp);
      }
      this.canHold = false;
      return true;
    }

    getGhostPosition() {
      if (!this.currentPiece) return null;
      let ghostY = this.currentPiece.y;
      while (!this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, ghostY + 1)) {
        ghostY++;
      }
      return {
        x: this.currentPiece.x,
        y: ghostY,
        matrix: this.currentPiece.matrix,
      };
    }

    /**
     * 受到对手攻击，垃圾行加入缓冲槽
     */
    addPendingGarbage(lines) {
      if (this.gameOver) return;
      this.pendingGarbage += lines;
    }

    /**
     * 锁定方块，并结算消行、连击、攻击发送与垃圾行升起
     */
    lockPiece() {
      if (!this.currentPiece) return;
      const { matrix, x, y, type } = this.currentPiece;

      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            const gridY = y + r;
            const gridX = x + c;
            if (gridY >= 0 && gridY < this.rows && gridX >= 0 && gridX < this.cols) {
              this.grid[gridY][gridX] = type;
            }
          }
        }
      }

      // 消行判定
      const cleared = this.clearLines();

      if (cleared > 0) {
        this.combo++;
        this.updateScore(cleared);

        // 计算攻击强度（Tetris Battle 经典规则）
        // 1行=0, 2行=1, 3行=2, 4行=4, Combo额外加成
        let attackLines = 0;
        if (cleared === 2) attackLines = 1;
        else if (cleared === 3) attackLines = 2;
        else if (cleared === 4) attackLines = 4;

        if (this.combo >= 2) {
          attackLines += Math.min(4, Math.floor(this.combo / 2));
        }

        // 优先抵消当前已有的待接收垃圾行
        if (this.pendingGarbage > 0 && attackLines > 0) {
          const offset = Math.min(this.pendingGarbage, attackLines);
          this.pendingGarbage -= offset;
          attackLines -= offset;
        }

        // 剩余攻击输出给对手
        if (attackLines > 0 && this.onAttack) {
          this.onAttack(attackLines);
        }

        if (this.onLineClear) {
          this.onLineClear(cleared, this.combo);
        }
      } else {
        this.combo = -1;

        // 若本回合没有消行，且存在待接收垃圾行，立刻从底部注入升起！
        if (this.pendingGarbage > 0) {
          this.injectGarbage(this.pendingGarbage);
          this.pendingGarbage = 0;
        }
      }

      this.spawnNextPiece();
    }

    /**
     * 底部升起指定行数的垃圾行
     */
    injectGarbage(linesCount) {
      if (this.gameOver) return;
      const count = Math.min(linesCount, this.rows);

      // 检查顶部是否会被挤爆
      for (let r = 0; r < count; r++) {
        if (this.grid[r].some((cell) => cell !== 0)) {
          this.handleTopOut();
          break;
        }
      }

      // 向上推移
      this.grid.splice(0, count);
      for (let i = 0; i < count; i++) {
        if (Math.random() < 0.4 || this.lastGarbageHoleCol === undefined) {
          this.lastGarbageHoleCol = Math.floor(Math.random() * this.cols);
        }
        const hole = this.lastGarbageHoleCol;
        const garbageRow = Array(this.cols).fill('G');
        garbageRow[hole] = 0; // 留出缺口
        this.grid.push(garbageRow);
      }

      // 若当前下落方块与新升起的障碍发生重叠碰撞，将其向上顺推
      if (this.currentPiece) {
        while (
          this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y) &&
          this.currentPiece.y > -2
        ) {
          this.currentPiece.y--;
        }
        if (this.checkCollision(this.currentPiece.matrix, this.currentPiece.x, this.currentPiece.y)) {
          this.handleTopOut();
        }
      }
    }

    /**
     * 清空盘面所有已有方块与障碍物
     */
    clearObstacles() {
      if (this.gameOver) return;
      for (let r = 0; r < this.rows; r++) {
        this.grid[r].fill(0);
      }
    }

    clearLines() {
      let linesCleared = 0;
      for (let r = this.rows - 1; r >= 0; r--) {
        if (this.grid[r].every((cell) => cell !== 0)) {
          this.grid.splice(r, 1);
          this.grid.unshift(Array(this.cols).fill(0));
          linesCleared++;
          r++;
        }
      }
      return linesCleared;
    }

    updateScore(linesCleared) {
      const linePoints = [0, 100, 300, 500, 800];
      const basePoints = linePoints[linesCleared] || 0;
      const comboBonus = Math.max(0, this.combo) * 50;

      this.score += (basePoints + comboBonus) * this.level;
      this.lines += linesCleared;
      this.level = Math.floor(this.lines / 10) + 1;
    }

    tick() {
      if (this.gameOver || this.isPaused) return false;
      return this.softDrop();
    }
  }

  return {
    TetrisGame,
    SHAPES,
    COLORS,
    PIECE_TYPES,
    SeededRandom,
    SynchronizedPieceStream,
  };
});
