# TypeSafe Jev Tetris

[English](#english) | [简体中文](#简体中文)

---

<a name="english"></a>
## English

An adversarial real-time Tetris battle and autonomous player powered by [TypeSafe](https://docs.typesafe.ai)'s **Jev (System One)** model. Play head-to-head against Jev in **Human vs. Jev Battle Mode** with synchronous 7-bag RNG and real-time garbage row attacks, or observe Jev's split-second typed decisions and live telemetry in **Single-Player Practice Mode**.

Inspired by [trungdq88/jev-tetris](https://github.com/trungdq88/jev-tetris), this project demonstrates the **"Code in Control + System One Intelligence"** paradigm: deterministic board physics and candidate enumerations are executed in pure code, while Jev provides instant, programmable common-sense decisions under active gravity.

> ⚡ **Zero Local Mock**: Decisions are 100% powered by the live TypeSafe cloud Jev model. Requires a valid TypeSafe API Key.

---

### Screenshots

#### 1. Single-Player Mode & Live Cognitive Telemetry
![Single Player Mode](docs/screenshots/single-player.png)
*Real-time AI auto-play displaying decision latency (~200ms), board safety score, confidence meter, candidate placement probabilities, and raw System One payload inspection.*

#### 2. Human vs. Jev Real-Time Battle Mode
![Human vs Jev Battle](docs/screenshots/human-vs-jev-battle.png)
*Split-screen versus arena featuring identical 7-bag piece sequences, incoming garbage warnings, line-clear cancellation, and Jev's dynamic tactical defense/attack stance.*

---

### Key Features

- **Human vs. Jev Real-Time Versus (`⚔️ Battle Mode`)**:
  - **Synchronized 7-Bag RNG**: Both human and Jev receive the exact same sequence of tetrominoes for absolute competitive fairness.
  - **Garbage Row Attacks**:
    - Clear 2 lines (Double): Send **1 garbage row** to the opponent.
    - Clear 3 lines (Triple): Send **2 garbage rows** to the opponent.
    - Clear 4 lines (Tetris): Send **4 critical garbage rows**!
    - Combos: Consecutive clears ramp up additional penalty rows.
  - **Garbage Meter & Instant Counter-Offset**: Incoming garbage enters a danger buffer meter. Clearing lines before the current piece locks cancels pending rows, reflecting leftover damage back to the attacker.
  - **Dynamic Stance Adaptation**: Jev senses opponent stack height and pending incoming attacks—shifting seamlessly between emergency line-clear defense and Tetris-ready well hoarding.

- **Single-Player Practice & Autonomous Agent**:
  - Configurable auto-play speeds: *Relaxed Observation*, *Standard Speed*, and *Blitz Rush*.
  - Full keyboard control alongside AI assistance.

- **Real-Time Cognitive Telemetry**:
  - Split-second API roundtrip latency (typically 200–500 ms).
  - Choice probabilities across candidate placements (`placement_1`, `placement_2`, etc.).
  - Board safety evaluation and decision confidence percentage.
  - Expandable drawer to inspect raw System One JSON queries and responses.

- **Built-in Secure Proxy & Audit Trail**:
  - Node.js backend proxies requests to `api.typesafe.ai` with zero browser exposure of upstream secrets.
  - All decisions and latency benchmarks are logged to [`typesafe_audit.log`](file:///d:/my/tetri-jev/typesafe_audit.log).

---

### How It Works: Code in Control + System One

Traditional LLMs (ChatGPT, Claude, etc.) struggle in real-time arcade games due to high reasoning latency (1–3s) and unpredictable structured output. TypeSafe Jev solves this with a two-layer architecture:

```
+-------------------------------------------------------------+
|                     Game Engine (Code)                      |
|  - 10x20 Board Physics & Collision Detection               |
|  - Active Gravity & Lock Timers                             |
|  - Enumerate All Legal Placements (Rotations & Columns)     |
|  - Feature Extraction (Holes, Surface Bumpiness, Well Depth)|
+------------------------------+------------------------------+
                               |
                   Structured State & Candidates
                               |
                               v
+-------------------------------------------------------------+
|              TypeSafe Jev (System One Cloud)                |
|  - Typed Choice Questions (Best Placement Selection)        |
|  - Typed Score Questions (Danger & Board Safety Evaluation) |
|  - Returns: Selection, Probability Distribution, Confidence |
+-------------------------------------------------------------+
```

---

### Keyboard Controls (Human Player)

| Key | Action |
| :--- | :--- |
| **← / →** or **A / D** | Move piece Left / Right |
| **↑** or **W** | Rotate Clockwise |
| **↓** or **S** | Soft Drop |
| **Space** | Hard Drop (Instant lock) |
| **C** | Hold current piece |
| **P** | Pause / Resume |

---

### Quick Start

#### Prerequisites
- Node.js 18+ installed.
- A TypeSafe API Key (obtain from [console.typesafe.ai/keys](https://console.typesafe.ai/keys)).

#### 1. Clone & Setup
```bash
git clone https://github.com/pojianbing/tetri-jev.git
cd tetri-jev
```

#### 2. Configure Environment (Optional)
You can set your API key in the environment or directly via the web interface:
```bash
# Windows PowerShell
$env:TYPESAFE_API_KEY="your-typesafe-api-key"

# Linux / macOS
export TYPESAFE_API_KEY="your-typesafe-api-key"
```

#### 3. Start the Server
```bash
npm start
# or: node server.js
```
The server will start at:
👉 **[http://localhost:4000](http://localhost:4000)**

#### 4. Play
1. Open [http://localhost:4000](http://localhost:4000) in your browser.
2. Enter and test your API key in the setup card (if not already set via environment).
3. Switch between **Single-Player Practice** and **Human vs. Jev Battle Mode** at the top.

---

### Automated Tests

The repository includes test suites verifying candidate evaluation, AI decision routing, garbage line mechanics, and long-term simulation:

```bash
npm test
```

This runs:
- `test/candidate-test.js`: Legal placement enumeration & heuristic feature sanity.
- `test/ai-test.js`: AI controller decision flow & timeout fallbacks.
- `test/battle-test.js`: Versus garbage calculation, buffering, and cancellation math.

---

<br/>

<a name="简体中文"></a>
## 简体中文

基于 [TypeSafe](https://docs.typesafe.ai) **Jev (System One)** 官方决策模型驱动的高对抗性实时俄罗斯方块。支持在 **人机对战模式 (Human vs. Jev)** 中与 Jev 展开基于相同随机序列（7-Bag）与垃圾行攻击/抵消的实时竞技，亦可在 **单人演练模式** 中以毫秒级时延实时观察 Jev 的落点决策分布与认知遥测指标。

本项目参考 [trungdq88/jev-tetris](https://github.com/trungdq88/jev-tetris) 的设计灵感，完整贯彻 **“代码掌管规则（Code in Control），模型赋予直觉（System One Intelligence）”** 的开发范式：由前端物理引擎负责确定性的下落规则与合法候选点枚举，Jev 云端模型在重力时限内提供极速、类型化的战略常识决策。

> ⚡ **零本地假玩**：所有 AI 决策 100% 由 TypeSafe 官方云端 Jev 模型实时产出，绝无本地规则替跑。必须配置有效 TypeSafe API Key。

---

### 系统界面实测

#### 1. 单人演练模式与 JEV 认知型监视器
![单人演练模式](docs/screenshots/single-player.png)
*实时展示 Jev 云端决策耗时（~200ms）、盘面安全评分、判定置信度、候选落点概率分布（Choice Probabilities）以及底层 System One JSON 通信抽屉。*

#### 2. 人机对战竞技模式 (Human vs. Jev)
![人机对战竞技模式](docs/screenshots/human-vs-jev-battle.png)
*双战场同屏竞技：镜像 7-Bag 随机发牌、实时垃圾行攻击计量标尺、消行快速抵消对冲，以及 Jev 攻防态势自适应调度。*

---

### 核心特性

- **人机对战竞技模式 (`⚔️ 人机对战模式`)**：
  - **绝对公平镜像发牌 (Synchronized 7-Bag)**：人类玩家与 Jev AI 共享完全相同的方块流（镜像随机序列），确保竞技纯粹基于决策质量与操作节奏。
  - **垃圾行攻击机制 (Garbage Lines Attack)**：
    - 消除 2 行（Double）：向对手发射 **1 行** 垃圾行；
    - 消除 3 行（Triple）：向对手发射 **2 行** 垃圾行；
    - 消除 4 行（Tetris）：向对手发射 **4 行** 强力垃圾行！
    - 连击（Combo）：连续消行追加额外攻击行。
  - **攻击缓冲与即时抵消 (Meter & Offset)**：受到攻击时，垃圾行进入左侧红色的 **垃圾行预警标尺**。若在方块锁定前自身快速消行，**优先抵消** 待接收的攻击行，溢出的攻击直接反弹对方！
  - **动态攻防态势自适应**：Jev 实时感知对方堆叠高度与自身待接收的垃圾行威胁——在危险时优先防守消行抵消，在局势平稳时蓄力留井打出 Tetris 4 行致命反击。

- **单人演练与自动托管**：
  - 支持多档下落托管速度：*慢速观察*、*标准速度*、*极速冲分*。
  - 支持人类玩家全键位接管与协同游玩。

- **云端认知监视器 (Cognitive Telemetry)**：
  - 实时监控 API 往返耗时（通常稳定在 200~500 ms）。
  - 直观呈现各候选落点概率分布（`placement_1`, `placement_2` 等）。
  - 盘面安全等级（Score）与决策置信度（Confidence）。
  - 可展开查看发送与接收的原生 System One JSON 负载。

- **内置安全代理与审计追踪**：
  - Node.js 轻量后端原生代理官方 API，隔离密钥与跨域风险。
  - 所有模型请求与决策耗时自动记录至 [`typesafe_audit.log`](file:///d:/my/tetri-jev/typesafe_audit.log)。

---

### 架构设计：Code in Control + System One

传统通用大模型（如 ChatGPT、Claude）在街机即时对战中受限于 1~3 秒的长延迟和不稳定的长文本输出。TypeSafe Jev 通过两层解耦架构化解这一难题：

```
+-------------------------------------------------------------+
|                      代码层（游戏引擎）                       |
|  - 10x20 棋盘物理、碰撞检测与软/硬降落点计算                  |
|  - 实时重力调度与锁定时限控制                                 |
|  - 枚举当前方块所有合法落点（旋转角度与列坐标）                |
|  - 特征提取（消除行数、新增空洞、表面凹凸、井位深度）          |
+------------------------------+------------------------------+
                               |
                       结构化状态与候选列表
                               |
                               v
+-------------------------------------------------------------+
|                TypeSafe Jev (System One 云端)               |
|  - 类型化 Choice 问答（最佳落点决策）                         |
|  - 类型化 Score 问答（盘面危险度评分）                        |
|  - 输出结构化决策、各选项概率分布与置信度                     |
+-------------------------------------------------------------+
```

---

### 人类操控键位

| 按键 | 功能 |
| :--- | :--- |
| **← / →** 或 **A / D** | 左右移动方块 |
| **↑** 或 **W** | 顺时针旋转方块 |
| **↓** 或 **S** | 软降加速下落 |
| **Space (空格)** | 硬降（立即瞬间落底并锁定） |
| **C** | 暂存当前方块 (Hold) |
| **P** | 暂停 / 继续游戏 |

---

### 快速开始

#### 环境要求
- 已安装 Node.js 18+。
- 拥有 TypeSafe API Key（在 [console.typesafe.ai/keys](https://console.typesafe.ai/keys) 获取）。

#### 1. 下载项目
```bash
git clone https://github.com/pojianbing/tetri-jev.git
cd tetri-jev
```

#### 2. 配置密钥（可选）
支持通过环境变量注入或在前端页面中实时输入：
```bash
# Windows PowerShell
$env:TYPESAFE_API_KEY="your-typesafe-api-key"

# Linux / macOS
export TYPESAFE_API_KEY="your-typesafe-api-key"
```

#### 3. 启动服务
```bash
npm start
# 或直接运行: node server.js
```
控制台将输出启动信息，访问地址为：
👉 **[http://localhost:4000](http://localhost:4000)**

#### 4. 开始体验
1. 浏览器打开 [http://localhost:4000](http://localhost:4000)；
2. 若未配置环境变量，在右侧输入框填入 TypeSafe API Key 并点击“保存并测试”；
3. 顶部自由切换 **单人演练模式** 与 **人机对战模式** 即可畅玩！

---

### 自动化测试套件

项目内置完备的自动化测试，覆盖候选落点生成、AI 调度容错、对战垃圾行抵消逻辑与稳定性压测：

```bash
npm test
```

测试覆盖：
- `test/candidate-test.js`：合法落点穷举算法与特征评分逻辑测试。
- `test/ai-test.js`：AI 控制器调用生命周期与超时降级兜底测试。
- `test/battle-test.js`：对战垃圾行发射、缓冲队列抵消计算逻辑测试。

---

### 开源许可证

[MIT License](LICENSE)
