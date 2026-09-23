/**
 * candidate.js - 候选落点模拟与特征提取算法 (支持单人模式与对战模式)
 * 负责遍历当前方块的所有合法落点，模拟物理下落并提取盘面特征（消行、空洞、崎岖度、垃圾行抵消与进攻等），
 * 为 TypeSafe Jev 提供结构化的候选选项。
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Tetris = require('./tetris.js');
    module.exports = factory(Tetris);
  } else {
    root.CandidateEvaluator = factory(root.Tetris);
  }
})(typeof self !== 'undefined' ? self : this, function (Tetris) {
  'use strict';

  const { SHAPES } = Tetris;

  // 深度复制二维网格
  function cloneGrid(grid) {
    return grid.map((row) => [...row]);
  }

  // 计算每列当前高度
  function getColumnHeights(grid, cols, rows) {
    const heights = Array(cols).fill(0);
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] !== 0) {
          heights[c] = rows - r;
          break;
        }
      }
    }
    return heights;
  }

  // 计算空洞数（有方块覆盖的空格）
  function countHoles(grid, cols, rows) {
    let holes = 0;
    for (let c = 0; c < cols; c++) {
      let blockFound = false;
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] !== 0) {
          blockFound = true;
        } else if (blockFound && grid[r][c] === 0) {
          holes++;
        }
      }
    }
    return holes;
  }

  // 计算表面崎岖度（相邻列高度差绝对值之和）
  function countBumpiness(heights) {
    let bumpiness = 0;
    for (let i = 0; i < heights.length - 1; i++) {
      bumpiness += Math.abs(heights[i] - heights[i + 1]);
    }
    return bumpiness;
  }

  // 计算井深总和（比两边邻居低2格以上的凹坑）
  function countWells(heights) {
    let wells = 0;
    for (let i = 0; i < heights.length; i++) {
      const left = i === 0 ? 20 : heights[i - 1];
      const right = i === heights.length - 1 ? 20 : heights[i + 1];
      const minNeighbor = Math.min(left, right);
      if (minNeighbor > heights[i]) {
        wells += minNeighbor - heights[i];
      }
    }
    return wells;
  }

  // 评估落点效果
  function evaluateSimulatedGrid(grid, cols, rows) {
    let linesCleared = 0;
    const simGrid = cloneGrid(grid);
    for (let r = rows - 1; r >= 0; r--) {
      if (simGrid[r].every((cell) => cell !== 0)) {
        simGrid.splice(r, 1);
        simGrid.unshift(Array(cols).fill(0));
        linesCleared++;
        r++;
      }
    }

    const heights = getColumnHeights(simGrid, cols, rows);
    const aggregateHeight = heights.reduce((sum, h) => sum + h, 0);
    const maxHeight = Math.max(...heights, 0);
    const holes = countHoles(simGrid, cols, rows);
    const bumpiness = countBumpiness(heights);
    const wells = countWells(heights);

    return {
      linesCleared,
      holes,
      bumpiness,
      aggregateHeight,
      maxHeight,
      wells,
      simGrid,
    };
  }

  /**
   * 生成指定方块在当前棋盘上的所有合法落点
   */
  function getAllLegalPlacements(game, pieceType) {
    const type = pieceType || (game.currentPiece ? game.currentPiece.type : 'I');
    const rotations = SHAPES[type];
    const placements = [];
    const visitedSignatures = new Set();

    for (let rot = 0; rot < rotations.length; rot++) {
      const matrix = rotations[rot];
      let minC = matrix[0].length;
      let maxC = 0;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            minC = Math.min(minC, c);
            maxC = Math.max(maxC, c);
          }
        }
      }

      const startX = -minC;
      const endX = game.cols - 1 - maxC;

      for (let x = startX; x <= endX; x++) {
        if (game.checkCollision(matrix, x, 0)) {
          continue;
        }

        let y = 0;
        while (!game.checkCollision(matrix, x, y + 1)) {
          y++;
        }

        const sig = `${rot}_${x}_${y}`;
        if (visitedSignatures.has(sig)) continue;
        visitedSignatures.add(sig);

        const tempGrid = cloneGrid(game.grid);
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix[r].length; c++) {
            if (matrix[r][c] !== 0) {
              const gy = y + r;
              const gx = x + c;
              if (gy >= 0 && gy < game.rows && gx >= 0 && gx < game.cols) {
                tempGrid[gy][gx] = type;
              }
            }
          }
        }

        const metrics = evaluateSimulatedGrid(tempGrid, game.cols, game.rows);

        placements.push({
          rotation: rot,
          x,
          y,
          matrix,
          metrics,
        });
      }
    }

    return placements;
  }

  /**
   * 提炼候选落点供 Jev 评估
   * @param {Object} game 游戏实例
   * @param {Object|number} options 配置项或最大候选数
   *   - mode: 'top4' | 'full' (默认 'top4'，'full' 为零预先剔除模式)
   *   - maxCandidates: 数量上限 (当 mode 为 'top4' 时生效，默认 4)
   *   - opponentGame: 对手游戏实例 (对战模式)
   */
  function selectCandidatesForJev(game, options = {}) {
    let mode = 'top4';
    let maxCandidates = 4;
    let opponentGame = null;

    if (typeof options === 'number') {
      maxCandidates = options;
      opponentGame = arguments[2] || null;
    } else if (options) {
      mode = options.mode || 'top4';
      maxCandidates = options.maxCandidates || 4;
      opponentGame = options.opponentGame || null;
    }

    const placements = getAllLegalPlacements(game);
    if (placements.length === 0) return [];

    const baseHeights = getColumnHeights(game.grid, game.cols, game.rows);
    const baseHoles = countHoles(game.grid, game.cols, game.rows);
    const baseBumpiness = countBumpiness(baseHeights);
    const baseMaxHeight = Math.max(...baseHeights, 0);

    const pendingGarbage = game.pendingGarbage || 0;
    const isUrgentDefense = pendingGarbage > 0 || baseMaxHeight > 13;

    placements.forEach((p) => {
      const m = p.metrics;
      const deltaHoles = m.holes - baseHoles;
      const deltaBump = m.bumpiness - baseBumpiness;

      // 计算产生的攻击力或抵消力
      let attackLines = 0;
      if (m.linesCleared === 2) attackLines = 1;
      else if (m.linesCleared === 3) attackLines = 2;
      else if (m.linesCleared === 4) attackLines = 4;

      const canceledGarbage = Math.min(pendingGarbage, attackLines);
      const sentAttack = Math.max(0, attackLines - canceledGarbage);

      // 对战增强评分函数 (仅用于 top4 模式粗排)
      p.heuristicScore =
        m.linesCleared * (isUrgentDefense ? 6.0 : 3.8) +
        canceledGarbage * 8.0 +
        sentAttack * 4.5 -
        m.holes * 9.0 -
        deltaHoles * 14.0 -
        m.bumpiness * 1.5 -
        m.maxHeight * 1.1 -
        m.aggregateHeight * 0.4;

      p.features = {
        rotation: p.rotation,
        target_column: p.x,
        lines_cleared: m.linesCleared,
        canceled_garbage: canceledGarbage,
        attacks_sent: sentAttack,
        new_holes_created: Math.max(0, deltaHoles),
        total_holes_after: m.holes,
        bumpiness_after: m.bumpiness,
        bumpiness_change: deltaBump,
        max_height_after: m.maxHeight,
        wells_count: m.wells,
      };
    });

    if (mode === 'full') {
      // 全息零预裁模式：去重同等动作后，按物理落点几何顺序（旋转角度 -> 列坐标）全量返回，绝不丢弃任何选项！
      const uniquePlacements = [];
      const seenAction = new Set();
      placements.sort((a, b) => (a.rotation !== b.rotation ? a.rotation - b.rotation : a.x - b.x));

      for (const p of placements) {
        const key = `${p.rotation}_${p.x}`;
        if (!seenAction.has(key)) {
          seenAction.add(key);
          uniquePlacements.push(p);
        }
      }
      return uniquePlacements;
    }

    // 精炼推荐模式 (Top-4)：按本地启发式评分粗排前 maxCandidates 个
    placements.sort((a, b) => b.heuristicScore - a.heuristicScore);

    const topPlacements = [];
    const seenAction = new Set();

    for (const p of placements) {
      const key = `${p.rotation}_${p.x}`;
      if (!seenAction.has(key)) {
        seenAction.add(key);
        topPlacements.push(p);
      }
      if (topPlacements.length >= maxCandidates) break;
    }

    return topPlacements;
  }

  // 保持向后兼容
  function selectTopCandidatesForJev(game, maxCandidates = 4, opponentGame = null) {
    return selectCandidatesForJev(game, { mode: 'top4', maxCandidates, opponentGame });
  }

  /**
   * 将候选集打包为 TypeSafe Jev System One 规范的 state 和 criteria
   */
  function formatStateForJev(game, candidates, opponentGame = null) {
    const heights = getColumnHeights(game.grid, game.cols, game.rows);
    const currentHoles = countHoles(game.grid, game.cols, game.rows);
    const currentMaxHeight = Math.max(...heights, 0);
    const pendingGarbage = game.pendingGarbage || 0;

    let danger = 'safe';
    if (currentMaxHeight > 14 || pendingGarbage >= 4) {
      danger = 'critical';
    } else if (currentMaxHeight > 9 || pendingGarbage > 0) {
      danger = 'medium';
    }

    const candidateDict = {};
    const criteriaDict = {};

    candidates.forEach((cand, idx) => {
      const id = `placement_${idx + 1}`;
      const f = cand.features;
      cand.id = id;

      candidateDict[id] = {
        action: `Rotate ${f.rotation * 90}° and drop at column ${f.target_column}`,
        clears_lines: f.lines_cleared,
        canceled_garbage: f.canceled_garbage || 0,
        attacks_sent: f.attacks_sent || 0,
        new_holes: f.new_holes_created,
        total_holes: f.total_holes_after,
        bumpiness: f.bumpiness_after,
        max_height: f.max_height_after,
      };

      let strategyTag = 'Balanced placement';
      if (f.canceled_garbage > 0) {
        strategyTag = `Defense: Clears ${f.lines_cleared} line(s) to cancel ${f.canceled_garbage} pending garbage line(s)`;
      } else if (f.attacks_sent >= 4) {
        strategyTag = `Tetris Smash: Launches 4 lethal garbage lines at opponent`;
      } else if (f.lines_cleared > 0 && f.new_holes_created === 0) {
        strategyTag = `Clean clear of ${f.lines_cleared} line(s) with 0 new holes`;
      } else if (f.new_holes_created === 0 && f.bumpiness_change <= 0) {
        strategyTag = 'Safe flattening move: keeps stack low and clean';
      }

      criteriaDict[id] = {
        strategy: strategyTag,
        details: candidateDict[id],
      };
    });

    const state = {
      game_status: {
        score: game.score,
        level: game.level,
        lines_cleared: game.lines,
        current_piece: game.currentPiece ? game.currentPiece.type : 'none',
        next_piece: game.nextPiece || 'none',
        board_danger: danger,
        current_max_height: currentMaxHeight,
        current_holes_count: currentHoles,
      },
      battle_context: {
        is_battle_mode: Boolean(opponentGame),
        pending_incoming_garbage: pendingGarbage,
        opponent_stack_height: opponentGame
          ? Math.max(...getColumnHeights(opponentGame.grid, opponentGame.cols, opponentGame.rows), 0)
          : 0,
        defense_priority: pendingGarbage > 0 ? 'URGENT_CANCEL' : 'NORMAL',
      },
      candidate_options: candidateDict,
    };

    return {
      state,
      criteria: criteriaDict,
      candidates,
    };
  }

  return {
    cloneGrid,
    getColumnHeights,
    countHoles,
    countBumpiness,
    countWells,
    evaluateSimulatedGrid,
    getAllLegalPlacements,
    selectCandidatesForJev,
    selectTopCandidatesForJev,
    formatStateForJev,
  };
});
