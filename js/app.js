/**
 * app.js - 游戏渲染、按键监听与 Jev 认知监视器调度 (支持单人演练与人机对战双模式)
 * 严格按照截图样式 1:1 像素级复刻，完整保留所有功能。
 */

document.addEventListener('DOMContentLoaded', async () => {
  'use strict';

  // 1. 初始化核心实例
  const jevClient = new JevClient.TypeSafeJevClient();

  // 单人模式实例
  const singleGame = new Tetris.TetrisGame(10, 20);
  const singleAiController = new AIController.AIController(singleGame, {
    jevClient,
    onDecisionMade: handleSingleJevDecision,
    onStatusChange: (enabled) => updateSingleRunningStateUI(enabled),
    onError: (err) => handleJevError(err),
  });
  // 默认根据截图设置为慢速观察
  singleAiController.setSpeed('slow');

  // 对战模式管理器
  let battleManager = null;
  let battleAiController = null;
  let currentMode = 'single'; // 'single' | 'battle'

  // 2. DOM 元素引用
  // 模式切换
  const tabSingle = document.getElementById('tab-single');
  const tabBattle = document.getElementById('tab-battle');
  const viewSingle = document.getElementById('view-single');
  const viewBattle = document.getElementById('view-battle');

  // 顶部指示灯与 API Key
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const inputApiKey = document.getElementById('input-api-key');
  const btnSaveKey = document.getElementById('btn-save-key');
  const keyHintMsg = document.getElementById('key-hint-msg');
  const keyCard = document.getElementById('key-card');

  // 单人模式 DOM
  const singleCanvas = document.getElementById('tetris-canvas');
  const singleCtx = singleCanvas.getContext('2d');
  const singleHoldCanvas = document.getElementById('hold-canvas');
  const singleHoldCtx = singleHoldCanvas.getContext('2d');
  const holdEmptyHint = document.getElementById('hold-empty-hint');
  const singleNextCanvas = document.getElementById('next-canvas');
  const singleNextCtx = singleNextCanvas.getContext('2d');

  const statScore = document.getElementById('stat-score');
  const statLines = document.getElementById('stat-lines');
  const statLevel = document.getElementById('stat-level');
  const statCombo = document.getElementById('stat-combo');

  const gameOverOverlay = document.getElementById('game-over-overlay');
  const finalScoreEl = document.getElementById('final-score');
  const pauseOverlay = document.getElementById('pause-overlay');

  const btnNewGame = document.getElementById('btn-new-game');
  const btnPause = document.getElementById('btn-pause');
  const btnRestartOverlay = document.getElementById('btn-restart-overlay');
  const btnResumeOverlay = document.getElementById('btn-resume-overlay');

  const toggleAutoPlay = document.getElementById('toggle-autoplay');
  const btnTogglePlay = document.getElementById('btn-toggle-play');
  const btnPlayIcon = document.getElementById('btn-play-icon');
  const btnPlayText = document.getElementById('btn-play-text');
  const aiRunningState = document.getElementById('ai-running-state');
  const speedButtons = document.querySelectorAll('.speed-btn');

  // 实时障碍注入 DOM
  const btnInject1 = document.getElementById('btn-inject-1');
  const btnInject2 = document.getElementById('btn-inject-2');
  const btnInject4 = document.getElementById('btn-inject-4');
  const btnClearObstacles = document.getElementById('btn-clear-obstacles');

  // 决策自由度模式与全量概率折叠 DOM
  const candModeButtons = document.querySelectorAll('.cand-mode-btn');
  const candidateModeBadge = document.getElementById('candidate-mode-badge');
  const candidateCountTag = document.getElementById('candidate-count-tag');
  const btnToggleAllProbs = document.getElementById('btn-toggle-all-probs');
  const moreCandidatesCount = document.getElementById('more-candidates-count');
  const btnEvalStep = document.getElementById('btn-eval-step');
  const candidateStatusBanner = document.getElementById('candidate-status-banner');
  let currentCandidateMode = 'top4';
  let showAllCandidates = false;
  let lastSingleDecisionData = null;

  function updateCandidateStatusBanner(type, message) {
    if (!candidateStatusBanner) return;
    candidateStatusBanner.className = `status-banner ${type}`;
    candidateStatusBanner.innerHTML = message;
  }

  // 单人 Jev 监视器
  const decisionLatency = document.getElementById('decision-latency');
  const metricModel = document.getElementById('metric-model');
  const metricBoardSafety = document.getElementById('metric-board-safety');
  const valConfidence = document.getElementById('val-confidence');
  const barConfidence = document.getElementById('bar-confidence');
  const probabilitiesContainer = document.getElementById('probabilities-container');
  const payloadDisplay = document.getElementById('payload-display');

  // 对战模式 DOM
  const battleHumanCanvas = document.getElementById('battle-human-canvas');
  const battleHumanCtx = battleHumanCanvas.getContext('2d');
  const battleHumanHold = document.getElementById('battle-human-hold');
  const battleHumanHoldCtx = battleHumanHold.getContext('2d');
  const battleHumanNext = document.getElementById('battle-human-next');
  const battleHumanNextCtx = battleHumanNext.getContext('2d');
  const humanGarbageBar = document.getElementById('human-garbage-bar');
  const battleHumanScore = document.getElementById('battle-human-score');
  const humanComboTag = document.getElementById('human-combo-tag');

  const battleJevCanvas = document.getElementById('battle-jev-canvas');
  const battleJevCtx = battleJevCanvas.getContext('2d');
  const battleJevHold = document.getElementById('battle-jev-hold');
  const battleJevHoldCtx = battleJevHold.getContext('2d');
  const battleJevNext = document.getElementById('battle-jev-next');
  const battleJevNextCtx = battleJevNext.getContext('2d');
  const jevGarbageBar = document.getElementById('jev-garbage-bar');
  const battleJevScore = document.getElementById('battle-jev-score');
  const jevBattleLatency = document.getElementById('jev-battle-latency');

  const battleScoreHuman = document.getElementById('battle-score-human');
  const battleScoreJev = document.getElementById('battle-score-jev');
  const battleRoundText = document.getElementById('battle-round-text');
  const attackBeamZone = document.getElementById('attack-beam-zone');

  const battleOverlay = document.getElementById('battle-overlay');
  const battleResultTitle = document.getElementById('battle-result-title');
  const battleResultDesc = document.getElementById('battle-result-desc');
  const btnNextRound = document.getElementById('btn-next-round');
  const btnExitBattle = document.getElementById('btn-exit-battle');
  const btnBattleRestart = document.getElementById('btn-battle-restart');
  const btnBattleResetMatch = document.getElementById('btn-battle-reset-match');

  const battleStrategyText = document.getElementById('battle-strategy-text');
  const battleProbabilitiesList = document.getElementById('battle-probabilities-list');
  const battleJevConfidenceTag = document.getElementById('battle-jev-confidence-tag');
  const battleHumanHoldHint = document.getElementById('battle-human-hold-hint');
  const battleHumanLines = document.getElementById('battle-human-lines');
  const battleHumanCombo = document.getElementById('battle-human-combo');
  const battleMetricPriority = document.getElementById('battle-metric-priority');
  const battleConfidenceNum = document.getElementById('battle-confidence-num');
  const battleBarConfidence = document.getElementById('battle-bar-confidence');
  const battlePayloadDisplay = document.getElementById('battle-payload-display');

  // 3. API Key 状态检查
  let hasValidKey = false;
  const savedApiKey = localStorage.getItem('typesafe_api_key');
  if (savedApiKey) {
    jevClient.setApiKey(savedApiKey);
    if (inputApiKey) inputApiKey.value = savedApiKey;
  }

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      if (data.hasEnvApiKey || jevClient.hasApiKey()) {
        hasValidKey = true;
      }
    }
  } catch (_) {
    hasValidKey = jevClient.hasApiKey();
  }

  updateConnectionStatusUI(hasValidKey);

  function updateConnectionStatusUI(isReady) {
    hasValidKey = isReady;
    if (isReady) {
      statusDot.style.backgroundColor = 'var(--accent-green)';
      statusDot.style.boxShadow = '0 0 8px var(--accent-green)';
      statusText.textContent = 'Jev 官方云端已就绪 (jev-latest)';
      keyHintMsg.style.display = 'block';
      keyHintMsg.style.color = 'var(--accent-green)';
      keyHintMsg.textContent = '✓ API Key 已配置就绪，可随时开启 Jev 在线潜入托管！';
    } else {
      statusDot.style.backgroundColor = '#ef4444';
      statusDot.style.boxShadow = '0 0 8px #ef4444';
      statusText.textContent = '未连接 Jev API (需配置 Key)';
      keyHintMsg.style.display = 'block';
      keyHintMsg.style.color = '#ef4444';
      keyHintMsg.textContent = '⚠️ 必须在此输入 TypeSafe API Key 才能调用 Jev。';
    }
  }

  function handleJevError(err) {
    updateSingleRunningStateUI(false);
    alert(`Jev 官方云端决策失败:\n${err.message}\n\n已停止托管。请检查 API Key。`);
    keyHintMsg.style.display = 'block';
    keyHintMsg.style.color = '#ef4444';
    keyHintMsg.textContent = `❌ 失败: ${err.message}`;
    keyCard.scrollIntoView({ behavior: 'smooth' });
    inputApiKey.focus();
  }

  // 4. 模式切换逻辑
  function switchMode(targetMode) {
    if (targetMode === 'battle') {
      if (!hasValidKey) {
        alert('无法开启人机对战！\n\n对战需要调用 TypeSafe Jev 云端模型决策。请先在右侧配置 API Key！');
        keyCard.scrollIntoView({ behavior: 'smooth' });
        inputApiKey.focus();
        return;
      }

      currentMode = 'battle';
      tabSingle.classList.remove('active');
      tabBattle.classList.add('active');
      viewSingle.style.display = 'none';
      viewBattle.style.display = 'flex';

      // 暂停单人模式 AI
      singleAiController.setEnabled(false);

      if (!battleManager) {
        initBattleManager();
      } else {
        battleManager.initRound();
        setupBattleAI();
      }
    } else {
      currentMode = 'single';
      tabBattle.classList.remove('active');
      tabSingle.classList.add('active');
      viewBattle.style.display = 'none';
      viewSingle.style.display = 'grid';

      if (battleAiController) {
        battleAiController.setEnabled(false);
      }
    }
  }

  tabSingle.addEventListener('click', () => switchMode('single'));
  tabBattle.addEventListener('click', () => switchMode('battle'));
  btnExitBattle.addEventListener('click', () => switchMode('single'));

  // 5. 对战模式初始化
  function initBattleManager() {
    battleManager = new BattleManager.BattleManager({
      onAttackEvent: (e) => {
        showAttackAnimation(e.from, e.to, e.lines);
      },
      onScoreUpdate: (scores) => {
        battleScoreHuman.textContent = scores.humanWins;
        battleScoreJev.textContent = scores.jevWins;
        battleRoundText.textContent = `ROUND ${scores.round} · 镜像同步发牌`;
      },
      onRoundEnd: (result) => {
        handleBattleRoundEnd(result);
      },
    });

    setupBattleAI();
  }

  function setupBattleAI() {
    battleAiController = new AIController.AIController(battleManager.jevGame, {
      opponentGame: battleManager.humanGame,
      jevClient,
      onDecisionMade: handleBattleJevDecision,
      onError: (err) => {
        alert(`对战中 Jev 云端调用失败: ${err.message}`);
      },
    });
    battleAiController.setSpeed('normal');
    battleAiController.setEnabled(true);
  }

  function showAttackAnimation(from, to, lines) {
    const floatEl = document.createElement('div');
    floatEl.className = `attack-float-text ${from === 'human' ? 'human-attack' : 'jev-attack'}`;
    floatEl.textContent = from === 'human' ? `🚀 玩家发射 ${lines} 行攻击！` : `💥 Jev 反击 ${lines} 行！`;
    floatEl.style.top = `${Math.floor(Math.random() * 120) + 40}px`;
    attackBeamZone.appendChild(floatEl);

    setTimeout(() => {
      floatEl.remove();
    }, 1200);
  }

  function handleBattleRoundEnd(result) {
    if (battleAiController) {
      battleAiController.setEnabled(false);
    }

    if (result.winner === 'human') {
      battleResultTitle.className = 'victory-title human-win';
      battleResultTitle.textContent = '🏆 VICTORY!';
      battleResultDesc.textContent = `太棒了！你在第 ${result.round} 回合成功击败了 TypeSafe Jev！`;
    } else {
      battleResultTitle.className = 'victory-title jev-win';
      battleResultTitle.textContent = '💀 DEFEAT!';
      battleResultDesc.textContent = `遗憾！TypeSafe Jev 赢得了第 ${result.round} 回合的对决！`;
    }

    battleOverlay.classList.remove('hidden');
  }

  btnNextRound.addEventListener('click', () => {
    battleOverlay.classList.add('hidden');
    battleManager.nextRound();
    setupBattleAI();
  });

  btnBattleRestart.addEventListener('click', () => {
    battleOverlay.classList.add('hidden');
    battleManager.initRound();
    setupBattleAI();
  });

  btnBattleResetMatch.addEventListener('click', () => {
    battleOverlay.classList.add('hidden');
    battleManager.resetMatch();
    setupBattleAI();
  });

  // 6. 对战模式 Jev 认知监视器渲染 (与首页完全一致的视觉与参数)
  function handleBattleJevDecision(decisionData) {
    const { evalResult, chosenCandidate, candidates } = decisionData;
    const answers = evalResult.answers;

    jevBattleLatency.textContent = `${evalResult.latencyMs} MS`;

    if (answers.best_placement) {
      const conf = answers.best_placement.confidence;
      const confPct = Math.round(conf * 100);
      battleJevConfidenceTag.textContent = `置信度 ${confPct}%`;
      if (battleConfidenceNum) battleConfidenceNum.textContent = `${confPct}%`;
      if (battleBarConfidence) battleBarConfidence.style.width = `${confPct}%`;

      const f = chosenCandidate.features;
      let tactic = '均势平整蓄力';
      let priorityText = 'NORMAL (常规平衡)';
      let priorityColor = '#4ade80';

      if (f.canceled_garbage > 0) {
        tactic = `🛡️ 紧急防守：消 ${f.lines_cleared} 行，成功抵消 ${f.canceled_garbage} 行垃圾！`;
        priorityText = 'CRITICAL (防御抵消)';
        priorityColor = '#ef4444';
      } else if (f.attacks_sent >= 4) {
        tactic = `⚔️ 强力进攻：发动 Tetris 4 行致命打击！`;
        priorityText = 'AGGRESSIVE (强力进攻)';
        priorityColor = '#f59e0b';
      } else if (f.attacks_sent > 0) {
        tactic = `⚡ 骚扰进攻：向对手发射 ${f.attacks_sent} 行垃圾！`;
        priorityText = 'HARASS (骚扰施压)';
        priorityColor = '#38bdf8';
      }

      battleStrategyText.innerHTML = `<strong>${tactic}</strong><br><span style="font-size: 11px; color: var(--text-dim);">策略落点: 旋 ${f.rotation * 90}°, 第 ${f.target_column} 列</span>`;
      if (battleMetricPriority) {
        battleMetricPriority.textContent = priorityText;
        battleMetricPriority.style.color = priorityColor;
      }

      const probs = answers.best_placement.probabilities || {};
      const chosenId = answers.best_placement.choice;
      battleProbabilitiesList.innerHTML = '';

      candidates.forEach((cand) => {
        const p = probs[cand.id] || 0;
        const pPct = (p * 100).toFixed(1);
        const isSelected = cand.id === chosenId;

        const item = document.createElement('div');
        item.className = `prob-item ${isSelected ? 'chosen' : ''}`;
        item.innerHTML = `
          <div class="prob-fill" style="width: ${pPct}%"></div>
          <div class="prob-content">
            <div class="prob-top">
              <span class="prob-title">${cand.id} (旋${cand.features.rotation * 90}°, 列${cand.features.target_column}) ${isSelected ? '<span class="chosen-badge">Jev 推荐选择</span>' : ''}</span>
              <span class="prob-pct">${pPct}%</span>
            </div>
            <div class="prob-desc">消行: ${cand.features.lines_cleared} | 抵消: ${cand.features.canceled_garbage} | 发射: ${cand.features.attacks_sent} | 空洞: ${cand.features.new_holes}</div>
          </div>
        `;
        battleProbabilitiesList.appendChild(item);
      });

      if (battlePayloadDisplay) {
        battlePayloadDisplay.textContent = JSON.stringify(evalResult, null, 2);
      }
    }
  }

  // 7. 单人模式 Jev 监视器渲染 (1:1 对齐截图细节)
  function handleSingleJevDecision(decisionData) {
    lastSingleDecisionData = decisionData;
    const { evalResult, candidates } = decisionData;
    const answers = evalResult.answers;

    decisionLatency.textContent = `${evalResult.latencyMs} MS`;
    metricModel.textContent = evalResult.model;

    if (answers.board_risk) {
      const risk = answers.board_risk;
      const scoreVal = risk.score;
      let label = '安全 (Safe)';
      let color = '#4ade80';
      if (scoreVal >= 1.5) {
        label = '危急 (Critical)';
        color = '#ef4444';
      } else if (scoreVal >= 0.7) {
        label = '受控中等 (Medium)';
        color = 'var(--accent-amber)';
      }
      metricBoardSafety.innerHTML = `<span style="color: ${color};">${label} (${Number(scoreVal).toFixed(2)})</span>`;
    }

    if (candidateCountTag) {
      const isFull = decisionData.candidateMode === 'full' || candidates.length > 4;
      candidateCountTag.textContent = isFull ? `(${candidates.length} 选项 · 零预选全息)` : `(4 选项 · 精炼推荐)`;
      candidateCountTag.style.color = isFull ? '#c084fc' : 'var(--secondary-cyan)';
    }

    if (answers.best_placement) {
      const conf = answers.best_placement.confidence;
      const confPct = Math.round(conf * 100);
      valConfidence.textContent = `${confPct}%`;
      barConfidence.style.width = `${confPct}%`;
      barConfidence.style.background =
        confPct > 70
          ? 'linear-gradient(90deg, #3b82f6, #06b6d4)'
          : confPct > 40
          ? 'linear-gradient(90deg, #6366f1, #3b82f6)'
          : 'linear-gradient(90deg, #f59e0b, #ef4444)';

      updateCandidateStatusBanner('success', `✓ Jev 云端决策已完成：推荐选择 <strong>${answers.best_placement.choice}</strong>（置信度 ${confPct}%）`);
      renderSingleProbabilities();
    }

    payloadDisplay.textContent = JSON.stringify(
      {
        request_to_typesafe: {
          state: decisionData.state,
          questions: decisionData.questions,
        },
        response_from_typesafe: {
          model: evalResult.model,
          latency: `${evalResult.latencyMs} ms`,
          answers: evalResult.answers,
          usage: evalResult.usage,
        },
      },
      null,
      2
    );
  }

  function renderSingleProbabilities() {
    if (!lastSingleDecisionData || !lastSingleDecisionData.evalResult.answers.best_placement) {
      renderCandidatePreview();
      return;
    }
    const { evalResult, candidates } = lastSingleDecisionData;
    const answers = evalResult.answers;
    const probs = answers.best_placement.probabilities || {};
    const chosenId = answers.best_placement.choice;

    // 智能排序：Jev 推荐落点排在第一位，其余候选按概率由高到低
    const sortedCandidates = [...candidates].sort((a, b) => {
      if (a.id === chosenId) return -1;
      if (b.id === chosenId) return 1;
      const pa = probs[a.id] || 0;
      const pb = probs[b.id] || 0;
      return pb - pa;
    });

    const isLargeList = sortedCandidates.length > 5;
    const displayList = isLargeList && !showAllCandidates ? sortedCandidates.slice(0, 5) : sortedCandidates;

    probabilitiesContainer.innerHTML = '';
    displayList.forEach((cand) => {
      const p = probs[cand.id] || 0;
      const pPct = (p * 100).toFixed(1);
      const isSelected = cand.id === chosenId;

      const item = document.createElement('div');
      item.className = `prob-item ${isSelected ? 'chosen' : ''}`;
      const f = cand.features;
      const detailsText = `消行: ${f.lines_cleared} | 新空洞: ${f.new_holes_created} | 崎岖: ${f.bumpiness_after}`;

      item.innerHTML = `
        <div class="prob-fill" style="width: ${pPct}%"></div>
        <div class="prob-content">
          <div class="prob-top">
            <span class="prob-title">${cand.id} (旋 ${f.rotation * 90}°, 列 ${f.target_column}) ${isSelected ? '<span class="chosen-badge">Jev 推荐选择</span>' : ''}</span>
            <span class="prob-pct">${pPct}%</span>
          </div>
          <div class="prob-desc">${detailsText}</div>
        </div>
      `;
      probabilitiesContainer.appendChild(item);
    });

    if (btnToggleAllProbs) {
      if (isLargeList) {
        btnToggleAllProbs.style.display = 'flex';
        if (showAllCandidates) {
          btnToggleAllProbs.textContent = '收起其余候选落点 ▴';
        } else {
          btnToggleAllProbs.textContent = `展开查看其余 ${sortedCandidates.length - 5} 个候选落点 ▾`;
        }
      } else {
        btnToggleAllProbs.style.display = 'none';
      }
    }
  }

  /**
   * 即时渲染当前方块的物理候选落点（用于模式切换或新方块就绪时即时响应）
   */
  function renderCandidatePreview() {
    if (!singleGame || !singleGame.currentPiece) return;

    const cands = CandidateEvaluator.selectCandidatesForJev(singleGame, {
      mode: currentCandidateMode,
      maxCandidates: 4,
    });

    if (candidateCountTag) {
      const isFull = currentCandidateMode === 'full' || cands.length > 4;
      candidateCountTag.textContent = isFull ? `(${cands.length} 选项 · 零预选全息)` : `(4 选项 · 精炼推荐)`;
      candidateCountTag.style.color = isFull ? '#c084fc' : 'var(--secondary-cyan)';
    }

    const modeName = currentCandidateMode === 'full' ? '全息零预裁' : '精炼推荐';
    updateCandidateStatusBanner('info', `💡 当前显示 ${cands.length} 个物理合法落点（${modeName}）。点击【⚡ 立即研判当前步】或上方【启动 Jev 云端自动游玩】，即可获取 Jev 云端真实落点概率！`);

    const isLargeList = cands.length > 5;
    const displayList = isLargeList && !showAllCandidates ? cands.slice(0, 5) : cands;

    probabilitiesContainer.innerHTML = '';
    displayList.forEach((cand, idx) => {
      const id = cand.id || `placement_${idx + 1}`;
      const f = cand.features;
      const detailsText = `消行: ${f.lines_cleared} | 新空洞: ${f.new_holes_created} | 崎岖: ${f.bumpiness_after}`;

      const item = document.createElement('div');
      item.className = 'prob-item';
      item.style.cursor = 'pointer';
      item.title = '点击即可向 Jev 官方云端发起当前步深度研判';
      item.innerHTML = `
        <div class="prob-fill" style="width: 0%;"></div>
        <div class="prob-content">
          <div class="prob-top">
            <span class="prob-title">${id} (旋 ${f.rotation * 90}°, 列 ${f.target_column}) <span class="chosen-badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">物理合法落点</span></span>
            <span class="prob-pct" style="color: var(--text-dim); font-size: 11px;">待研判</span>
          </div>
          <div class="prob-desc">${detailsText}</div>
        </div>
      `;

      item.addEventListener('click', () => {
        triggerSingleStepEvaluation();
      });

      probabilitiesContainer.appendChild(item);
    });

    if (btnToggleAllProbs) {
      if (isLargeList) {
        btnToggleAllProbs.style.display = 'flex';
        if (showAllCandidates) {
          btnToggleAllProbs.textContent = '收起其余候选落点 ▴';
        } else {
          btnToggleAllProbs.textContent = `展开查看其余 ${cands.length - 5} 个候选落点 ▾`;
        }
      } else {
        btnToggleAllProbs.style.display = 'none';
      }
    }
  }

  function updateSingleRunningStateUI(isRunning) {
    toggleAutoPlay.checked = isRunning;
    if (isRunning) {
      btnPlayIcon.textContent = '⏸';
      btnPlayText.textContent = '暂停 Jev 云端自动游玩';
      btnTogglePlay.classList.add('btn-secondary');
      btnTogglePlay.classList.remove('btn-primary');
      aiRunningState.innerHTML = '<span style="color: var(--secondary-cyan);">当前状态：已启用 (正在由 Jev 云端接管)</span>';
      updateCandidateStatusBanner('thinking', '🤖 Jev 云端自动驾驶已接管，实时深度研判并执行落子...');
    } else {
      btnPlayIcon.textContent = '▶';
      btnPlayText.textContent = '启动 Jev 云端自动游玩';
      btnTogglePlay.classList.add('btn-primary');
      btnTogglePlay.classList.remove('btn-secondary');
      aiRunningState.textContent = '当前状态：已启用 (等待启动)';
    }
  }

  let isEvaluatingStep = false;
  async function triggerSingleStepEvaluation() {
    if (isEvaluatingStep) return;
    if (!hasValidKey) {
      updateCandidateStatusBanner('warn', '⚠️ 未配置 TypeSafe API Key，请先在上方输入 API Key 后进行研判！');
      keyCard.scrollIntoView({ behavior: 'smooth' });
      inputApiKey.focus();
      return;
    }
    if (!singleGame || singleGame.gameOver) {
      updateCandidateStatusBanner('warn', '⚠️ 游戏未开始或已结束，请先开启新局。');
      return;
    }
    if (!singleGame.currentPiece) {
      updateCandidateStatusBanner('warn', '⚠️ 当前暂无活动方块。');
      return;
    }

    isEvaluatingStep = true;
    if (btnEvalStep) {
      btnEvalStep.disabled = true;
      btnEvalStep.textContent = '⚡ 研判中...';
    }
    const modeDesc = currentCandidateMode === 'full' ? '全息零预裁' : '精炼推荐';
    updateCandidateStatusBanner('thinking', `⏳ 正在向 TypeSafe Jev 官方云端发起深度研判 (${modeDesc})...`);

    try {
      const decisionData = await singleAiController.evaluateStep(false);
      if (decisionData) {
        handleSingleJevDecision(decisionData);
      }
    } catch (err) {
      console.error('单步研判失败:', err);
      updateCandidateStatusBanner('warn', `❌ Jev 研判失败: ${err.message || err}`);
    } finally {
      isEvaluatingStep = false;
      if (btnEvalStep) {
        btnEvalStep.disabled = false;
        btnEvalStep.textContent = '⚡ 立即研判当前步';
      }
    }
  }

  // 8. 物理下落与 AI 推进循环
  let lastSingleDropTime = performance.now();
  let lastSingleAiTime = performance.now();
  let lastBattleHumanDropTime = performance.now();
  let lastBattleAiTime = performance.now();

  function gameLoop(now) {
    if (currentMode === 'single') {
      if (!singleGame.gameOver && !singleGame.isPaused) {
        if (!singleAiController.isEnabled) {
          if (now - lastSingleDropTime > Math.max(100, 800 - (singleGame.level - 1) * 60)) {
            singleGame.tick();
            lastSingleDropTime = now;
          }
        } else {
          if (now - lastSingleAiTime > singleAiController.stepInterval) {
            singleAiController.update();
            lastSingleAiTime = now;
          }
        }
      }
      renderSingleView();
    } else if (currentMode === 'battle' && battleManager) {
      const human = battleManager.humanGame;
      const jev = battleManager.jevGame;

      if (!battleManager.isRoundOver) {
        if (!human.gameOver && !human.isPaused) {
          if (now - lastBattleHumanDropTime > Math.max(120, 700 - (human.level - 1) * 50)) {
            human.tick();
            lastBattleHumanDropTime = now;
          }
        }

        if (battleAiController && battleAiController.isEnabled && !jev.gameOver) {
          if (now - lastBattleAiTime > battleAiController.stepInterval) {
            battleAiController.update();
            lastBattleAiTime = now;
          }
        }
      }

      renderBattleView();
    }

    requestAnimationFrame(gameLoop);
  }

  // 9. 单人模式渲染
  let lastObservedPiece = null;
  function renderSingleView() {
    renderBoard(singleCtx, singleCanvas, singleGame);

    // 当未开启 AI 自动游玩时，检测方块是否发生变动（下落产生新方块或 hold），自动同步候选落点预览
    if (!singleAiController.isEnabled && singleGame.currentPiece !== lastObservedPiece) {
      lastObservedPiece = singleGame.currentPiece;
      lastSingleDecisionData = null;
      renderCandidatePreview();
    }

    // 暂存方块显示控制
    if (singleGame.holdPiece) {
      if (holdEmptyHint) holdEmptyHint.style.display = 'none';
      singleHoldCanvas.style.display = 'block';
      renderPiecePreview(singleHoldCtx, singleHoldCanvas, singleGame.holdPiece);
    } else {
      if (holdEmptyHint) holdEmptyHint.style.display = 'block';
      singleHoldCanvas.style.display = 'none';
    }

    renderPiecePreview(singleNextCtx, singleNextCanvas, singleGame.nextPiece);

    statScore.textContent = singleGame.score.toLocaleString();
    statLines.textContent = singleGame.lines;
    statLevel.textContent = singleGame.level;
    statCombo.textContent = Math.max(0, singleGame.combo);

    if (singleGame.gameOver) {
      finalScoreEl.textContent = singleGame.score.toLocaleString();
      gameOverOverlay.classList.remove('hidden');
    } else {
      gameOverOverlay.classList.add('hidden');
    }

    if (singleGame.isPaused && !singleGame.gameOver) {
      pauseOverlay.classList.remove('hidden');
    } else {
      pauseOverlay.classList.add('hidden');
    }
  }

  // 10. 对战模式渲染 (与首页完全一致的交互细节)
  function renderBattleView() {
    if (!battleManager) return;
    const human = battleManager.humanGame;
    const jev = battleManager.jevGame;

    renderBoard(battleHumanCtx, battleHumanCanvas, human);
    renderBoard(battleJevCtx, battleJevCanvas, jev);

    if (human.holdPiece) {
      if (battleHumanHoldHint) battleHumanHoldHint.style.display = 'none';
      battleHumanHold.style.display = 'block';
      renderPiecePreview(battleHumanHoldCtx, battleHumanHold, human.holdPiece);
    } else {
      if (battleHumanHoldHint) battleHumanHoldHint.style.display = 'block';
      battleHumanHold.style.display = 'none';
    }

    renderPiecePreview(battleHumanNextCtx, battleHumanNext, human.nextPiece);
    renderPiecePreview(battleJevHoldCtx, battleJevHold, jev.holdPiece);
    renderPiecePreview(battleJevNextCtx, battleJevNext, jev.nextPiece);

    const hGarbagePct = Math.min(100, (human.pendingGarbage / 14) * 100);
    humanGarbageBar.style.height = `${hGarbagePct}%`;
    const jGarbagePct = Math.min(100, (jev.pendingGarbage / 14) * 100);
    jevGarbageBar.style.height = `${jGarbagePct}%`;

    battleHumanScore.textContent = human.score.toLocaleString();
    battleJevScore.textContent = jev.score.toLocaleString();
    if (battleHumanLines) battleHumanLines.textContent = human.lines;
    if (battleHumanCombo) battleHumanCombo.textContent = Math.max(0, human.combo);

    if (human.combo >= 2) {
      humanComboTag.style.display = 'inline-block';
      humanComboTag.textContent = `COMBO ${human.combo}`;
    } else {
      humanComboTag.style.display = 'none';
    }
  }

  // 通用棋盘绘制方法（动态自适应画布尺寸，质感与大屏完美契合）
  function renderBoard(context, canvasEl, gameObj, blockSize) {
    const actualBlockSize = blockSize || Math.floor(canvasEl.width / gameObj.cols);
    context.clearRect(0, 0, canvasEl.width, canvasEl.height);

    // 网格线
    context.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    context.lineWidth = 1;
    for (let c = 0; c <= gameObj.cols; c++) {
      context.beginPath();
      context.moveTo(c * actualBlockSize, 0);
      context.lineTo(c * actualBlockSize, canvasEl.height);
      context.stroke();
    }
    for (let r = 0; r <= gameObj.rows; r++) {
      context.beginPath();
      context.moveTo(0, r * actualBlockSize);
      context.lineTo(canvasEl.width, r * actualBlockSize);
      context.stroke();
    }

    // 已锁定的方块
    for (let r = 0; r < gameObj.rows; r++) {
      for (let c = 0; c < gameObj.cols; c++) {
        const type = gameObj.grid[r][c];
        if (type !== 0) {
          drawBlock(context, c * actualBlockSize, r * actualBlockSize, Tetris.COLORS[type], actualBlockSize);
        }
      }
    }

    // 幽灵方块投影
    if (gameObj.currentPiece && !gameObj.gameOver) {
      const ghost = gameObj.getGhostPosition();
      if (ghost && ghost.y !== gameObj.currentPiece.y) {
        drawGhostPiece(context, ghost, actualBlockSize);
      }
    }

    // 当前下落方块
    if (gameObj.currentPiece && !gameObj.gameOver) {
      const { matrix, x, y, color } = gameObj.currentPiece;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (matrix[r][c] !== 0) {
            drawBlock(context, (x + c) * actualBlockSize, (y + r) * actualBlockSize, color, actualBlockSize, true);
          }
        }
      }
    }
  }

  function drawBlock(context, px, py, color, size, isActive = false) {
    const padding = 1;
    context.fillStyle = color;
    context.fillRect(px + padding, py + padding, size - padding * 2, size - padding * 2);

    // 细腻立体边缘与高光
    context.fillStyle = 'rgba(255, 255, 255, 0.25)';
    context.fillRect(px + padding, py + padding, size - padding * 2, 2);
    context.fillRect(px + padding, py + padding, 2, size - padding * 2);

    context.fillStyle = 'rgba(0, 0, 0, 0.25)';
    context.fillRect(px + padding, py + size - padding - 2, size - padding * 2, 2);
    context.fillRect(px + size - padding - 2, py + padding, 2, size - padding * 2);

    context.strokeStyle = isActive ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.2)';
    context.lineWidth = 1;
    context.strokeRect(px + padding, py + padding, size - padding * 2, size - padding * 2);
  }

  function drawGhostPiece(context, ghost, size) {
    const { matrix, x, y } = ghost;
    context.save();
    context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    context.lineWidth = 1.2;
    context.setLineDash([3, 2]);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const px = (x + c) * size + 2;
          const py = (y + r) * size + 2;
          context.strokeRect(px, py, size - 4, size - 4);
        }
      }
    }
    context.restore();
  }

  function renderPiecePreview(context, canvasEl, pieceType, previewBlockSize) {
    context.clearRect(0, 0, canvasEl.width, canvasEl.height);
    if (!pieceType) return;

    const actualBlockSize = previewBlockSize || Math.floor(canvasEl.width / 4.4);
    const matrix = Tetris.SHAPES[pieceType][0];
    const color = Tetris.COLORS[pieceType];

    const width = matrix[0].length * actualBlockSize;
    const height = matrix.length * actualBlockSize;
    const offsetX = Math.floor((canvasEl.width - width) / 2);
    const offsetY = Math.floor((canvasEl.height - height) / 2);

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c] !== 0) {
          const px = offsetX + c * actualBlockSize;
          const py = offsetY + r * actualBlockSize;
          context.fillStyle = color;
          context.fillRect(px + 1, py + 1, actualBlockSize - 2, actualBlockSize - 2);
          context.fillStyle = 'rgba(255, 255, 255, 0.2)';
          context.fillRect(px + 1, py + 1, actualBlockSize - 2, 2);
          context.fillRect(px + 1, py + 1, 2, actualBlockSize - 2);
        }
      }
    }
  }

  // 11. 控制交互
  function toggleSingleAutoPlayAction() {
    if (!singleAiController.isEnabled) {
      if (!hasValidKey) {
        alert('无法开启 Jev 自动托管！\n\n系统已禁用本地降级。请先在上方输入您的 TypeSafe API Key 并点击保存！');
        keyCard.scrollIntoView({ behavior: 'smooth' });
        inputApiKey.focus();
        return;
      }
      if (singleGame.gameOver) singleGame.reset();
      singleGame.isPaused = false;
      singleAiController.setEnabled(true);
    } else {
      singleAiController.setEnabled(false);
    }
  }

  btnTogglePlay.addEventListener('click', toggleSingleAutoPlayAction);
  if (toggleAutoPlay) toggleAutoPlay.addEventListener('change', toggleSingleAutoPlayAction);
  function handleResetSingleGame() {
    singleGame.reset();
    lastSingleDecisionData = null;
    lastObservedPiece = null;
    renderCandidatePreview();
  }

  btnNewGame.addEventListener('click', handleResetSingleGame);
  btnRestartOverlay.addEventListener('click', handleResetSingleGame);
  btnPause.addEventListener('click', () => (singleGame.isPaused = !singleGame.isPaused));
  btnResumeOverlay.addEventListener('click', () => (singleGame.isPaused = false));

  if (btnEvalStep) {
    btnEvalStep.addEventListener('click', () => {
      triggerSingleStepEvaluation();
    });
  }

  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      speedButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const speed = btn.getAttribute('data-speed');
      singleAiController.setSpeed(speed);
      if (battleAiController) {
        battleAiController.setSpeed(speed);
      }
    });
  });

  // 决策自由度模式切换 (精炼4选1 vs 零预裁全息自由)
  candModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      candModeButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-candidate-mode');
      currentCandidateMode = mode;
      singleAiController.setCandidateMode(mode);

      if (candidateModeBadge) {
        candidateModeBadge.textContent = mode === 'full' ? '🧠 全息自由 (零预选)' : '🎯 精炼 4 选 1';
        candidateModeBadge.style.color = mode === 'full' ? '#c084fc' : 'var(--secondary-cyan)';
        candidateModeBadge.style.borderColor = mode === 'full' ? 'rgba(192, 132, 252, 0.4)' : 'rgba(56, 189, 248, 0.25)';
      }

      // 即时重绘：无论 AI 是否正在运行，立即根据当前方块呈现对应模式的落点总数与候选结构！
      renderCandidatePreview();
    });
  });

  // 展开/收起全量候选落点
  if (btnToggleAllProbs) {
    btnToggleAllProbs.addEventListener('click', () => {
      showAllCandidates = !showAllCandidates;
      if (lastSingleDecisionData && lastSingleDecisionData.candidateMode === currentCandidateMode) {
        renderSingleProbabilities();
      } else {
        renderCandidatePreview();
      }
    });
  }

  // 实时障碍注入事件监听
  function handleInjectObstacles(lines) {
    if (singleGame.gameOver) {
      singleGame.reset();
    }
    singleGame.injectGarbage(lines);

    // 棋盘震颤视觉反馈
    singleCanvas.classList.remove('shake-animation');
    void singleCanvas.offsetWidth;
    singleCanvas.classList.add('shake-animation');

    if (!singleAiController.isEnabled) {
      lastSingleDecisionData = null;
      renderCandidatePreview();
    }
  }

  if (btnInject1) btnInject1.addEventListener('click', () => handleInjectObstacles(1));
  if (btnInject2) btnInject2.addEventListener('click', () => handleInjectObstacles(2));
  if (btnInject4) btnInject4.addEventListener('click', () => handleInjectObstacles(4));
  if (btnClearObstacles) {
    btnClearObstacles.addEventListener('click', () => {
      singleGame.clearObstacles();
      if (!singleAiController.isEnabled) {
        lastSingleDecisionData = null;
        renderCandidatePreview();
      }
    });
  }

  // 保存 API Key
  btnSaveKey.addEventListener('click', async () => {
    const key = inputApiKey.value.trim();
    if (!key) {
      localStorage.removeItem('typesafe_api_key');
      jevClient.setApiKey('');
      updateConnectionStatusUI(false);
      singleAiController.setEnabled(false);
      alert('已清除 API Key。');
      return;
    }

    btnSaveKey.disabled = true;
    btnSaveKey.textContent = '测试连接中...';

    try {
      const testRes = await fetch('/api/systemone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          state: 'test connection',
          model: 'jev-latest',
          questions: {
            is_valid: {
              type: 'noul',
              instructions: 'Is this connection working?',
            },
          },
        }),
      });

      if (!testRes.ok) {
        let errDesc = `HTTP ${testRes.status}`;
        try {
          const errJson = await testRes.json();
          errDesc = errJson.error || errJson.detail?.message || JSON.stringify(errJson);
        } catch (_) {}
        throw new Error(errDesc);
      }

      jevClient.setApiKey(key);
      localStorage.setItem('typesafe_api_key', key);
      updateConnectionStatusUI(true);

      if (currentMode === 'single') {
        if (singleGame.gameOver) singleGame.reset();
        singleGame.isPaused = false;
        singleAiController.setEnabled(true);
      }

      alert('🎉 恭喜！TypeSafe API Key 验证成功！\n\n已就绪，可随时进行单人托管或人机对战！');
    } catch (err) {
      alert(`❌ API Key 验证失败:\n${err.message}\n\n请检查您输入的 Key 是否正确。`);
      keyHintMsg.style.display = 'block';
      keyHintMsg.style.color = '#ef4444';
      keyHintMsg.textContent = `❌ 验证失败: ${err.message}`;
    } finally {
      btnSaveKey.disabled = false;
      btnSaveKey.textContent = '保存并测试';
    }
  });

  // 12. 统一键盘监听
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }

    const activeHumanGame = currentMode === 'single' ? singleGame : battleManager ? battleManager.humanGame : null;
    if (!activeHumanGame) return;

    if (e.key === 'p' || e.key === 'P') {
      activeHumanGame.isPaused = !activeHumanGame.isPaused;
      return;
    }
    if (activeHumanGame.gameOver || activeHumanGame.isPaused) return;

    switch (e.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        activeHumanGame.moveLeft();
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        activeHumanGame.moveRight();
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        activeHumanGame.rotate(true);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        activeHumanGame.softDrop();
        break;
      case ' ':
        activeHumanGame.hardDrop();
        break;
      case 'c':
      case 'C':
        activeHumanGame.hold();
        break;
      default:
        break;
    }
  });

  // 初始渲染当前方块的物理候选落点预览
  renderCandidatePreview();

  // 启动主渲染循环
  requestAnimationFrame(gameLoop);
});
