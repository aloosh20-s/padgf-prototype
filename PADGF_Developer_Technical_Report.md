# PADGF Developer Technical & Architecture Report

This document serves as the comprehensive technical specification and detailed developer report for the PreSend Adaptive Decision Guard Framework (PADGF) Prototype. It covers the full systemic architecture, module-by-module breakdowns, logic flows, API routing, and dependency structures implemented from Phase 1 through Phase 3 and the Dashboard.

---

## 1. System Architecture & Tech Stack

The prototype leverages a full-stack JavaScript environment focusing on localized EVM testing natively without deploying custom contracts.

* **Smart Contract / EVM Framework**: Hardhat `v2.22` with `@nomicfoundation/hardhat-toolbox`.
* **Blockchain Interaction**: `ethers.js v6.16.0`
* **Runtime**: Node.js `v20.12.2` (Windows x64 localized).
* **Frontend Dashboard**: Vanilla HTML5, CSS3, JavaScript (ES6+).
* **Backend Dashboard API**: Native Node.js `http` and `child_process` modules (No Express dependency).
* **Data Persistence**: JSON I/O via native `fs` module; HTML5 `localStorage` for decoupled front-end GUI state.

### Deterministic Test Strategy
The environment relies on a **Deterministic Mainnet Fork**. Hardhat pins the execution state specifically to Mainnet block **`19400000`** via `process.env.MAINNET_RPC_URL` (Alchemy/Infura). By maintaining this rigid state timeline, variable network noise is zeroed out, meaning every execution of phase one logically identically replicates the pool reserves.

---

## 2. Directory Structure & File Taxonomy

```text
padgf-prototype/
├── .env                        # RPC Keys / Environment secrets
├── hardhat.config.js           # Network fork parameters & block pinning
├── src/                        # Core algorithmic modules
│   ├── constants.js            # WETH/USDC addresses & Uniswap V2 Router ABI parameters
│   ├── decisionEngine.js       # PADGF Threshold mapping (Execute, Delay, Block)
│   ├── dexInteraction.js       # getQuote() and executeSwap() wrappers via ethers
│   ├── providerSetup.js        # Whale Account impersonation setup (`hardhat_impersonateAccount`)
│   ├── resultLogger.js         # JSON / CSV aggregation engine
│   └── riskEvaluator.js        # Slippage deviation and mathematical heuristics
├── scripts/                    # Actionable execution scripts
│   ├── baseline-swap.js        # Phase 1: 1% Slippage Ground Truth Control
│   ├── sandwich-attack.js      # Phase 2: Attacker Tx1, Victim Tx, Attacker Tx2
│   ├── protected-swap.js       # Phase 3: Pre-broadcast risk invocation
│   └── custom-run.js           # CLI-driven dynamic inputs parsing `process.env` commands
├── dashboard/                  # UI Supervisor ecosystem
│   ├── server.js               # Node backend orchestrator (`http.createServer`)
│   └── public/                 
│       ├── index.html          # GUI Document map (Official VS Exploratory modes)
│       ├── script.js           # API request client, Chart plotting, LocalStorage sync
│       └── style.css           # UI layout parameters and modals
├── results/                    # Official Thesis Database
│   ├── baseline_result.json    
│   ├── sandwich_attack_result.json 
│   ├── protected_swap_result.json
│   └── custom_runs/            # Isolated exploratory sandboxes mapping to custom-run.js
└── Run-PADGF-Dashboard.bat     # Windows Batch macro orchestrator
```

---

## 3. Core Module Technical Breakdown (`/src`)

### A. Impersonation & Provider (`providerSetup.js`)
Instead of deploying mock Uniswap pools, we utilize `hardhat_impersonateAccount` to hijack a recognized whale profile holding massive amounts of WETH (`0x28C...`). To satisfy EVM tx validation, the script uses `hardhat_setBalance` to seed the fake signer with local native ETH for gas.

### B. DEX Interaction Orchestration (`dexInteraction.js`)
Wraps the core interactions with the Uniswap V2 Router (`0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`).
* `getQuote()` applies the router's `getAmountsOut()` to fetch mathematical expectations independent of the mempool.
* `executeSwap()` triggers `swapExactTokensForTokens` with dynamic block deadlines and `slippage_tolerance` applied directly on the minimum threshold calculated via the smart contract.

### C. Evaluation Framework Object (`riskEvaluator.js`)
Takes three critical input heuristics from simulated states and standardizes them:
1. `raw_slippage_deviation`: Diff between Expected Quote and Actual Simulated Yield.
2. `raw_price_impact`: Approximation of curve manipulation.
3. `raw_gas_sensitivity`: Spikes in Gwei parameters indicating front-runner priority gas auctions (PGA).

**Algorithm:**
`normalized_risk_score = (w1 * slippage) + (w2 * price) + (w3 * gas)`

### D. Decision Engine Router (`decisionEngine.js`)
Takes the output of `riskEvaluator.js` against established parameters (e.g. `tau1: 0.3`, `tau2: 0.7`).
* `< tau1` = **Execute**
* `> tau1 < tau2` = **Delay**
* `> tau2` = **Block**
The script then explicitly returns `execution_allowed: true/false`.

---

## 4. Operational Execution Scripts (`/scripts`)

The Phase modules load into the Hardhat environment simulating the exact timeline needed:

### Phase 2: Sandwich Execution Logic (`sandwich-attack.js`)
This script instantiates two separate `ethers.Signer` objects: User and Attacker.
1. The script simulates an inflated 5.0 WETH reserve push from **AttackerSigner**.
2. Following the block index, it executes **UserSigner**'s 1.0 tx forcing it to swallow a mathematically inferior fill rate.
3. Immediately processes **AttackerSigner** reversing their direction, liquidating USDC to recoup initial ETH plus extracted capital.

### Custom Parameter Automation (`custom-run.js`)
Designed uniquely to prevent hardcoded bias during supervisor tests. The script reads logic from native OS wrappers driven by `server.js`:
```javascript
const CUSTOM_AMOUNT = process.env.CUSTOM_AMOUNT || "1.0";
const CUSTOM_SLIPPAGE = parseFloat(process.env.CUSTOM_SLIPPAGE || "1");
const CUSTOM_SCENARIO = process.env.CUSTOM_SCENARIO || "baseline";
```

---

## 5. Supervisor Dashboard Middleware (`/dashboard`)

Built robustly to orchestrate terminal workflows inside a UI securely.

### The Backend `server.js` Architecture
Operates a bare native node `http` loop traversing routes.
* Native **GET `/api/results`** securely `fs.readFile()`s the verified results from `/results/`.
* Native **POST `/api/run/[phase]`** routes utilize the `child_process.exec()` methodology to instantiate invisible background shell windows executing: `npx hardhat run [script]`.
* The critical **POST `/api/run/custom`** leverages string literal injections to pipeline variables directly into `cmd.exe`: 
  `set CUSTOM_AMOUNT=${amount}&& set CUSTOM_SLIPPAGE=${slippage}&& npx hardhat run scripts/custom-run.js`.

### The Frontend Engineering (`index.html`, `script.js`)
* **API Ingestion**: Processes backend outputs formatting JSON directly into a dynamic `table` DOM entity.
* **Component Bar Chanting**: Synthesizes pure CSS and JS dynamic `height%` elements visually mapping baseline vs outcome value extraction ratios.
* **State Persistence Integration**: Utilizing HTML5 FileReader API to parse user-uploaded images (`<img>`), caching the processed DataURI Base64 string directly into `localStorage`. This guarantees visual identity components of the "About the Authors" module natively persist without complex database implementations (SQL/Mongo).

---

## 6. End-To-End Security & Extensibility Profile

### Data Methodological Integrity
To eliminate potential corruption within the thesis results, the platform hard-routes inputs originating from `index.html` exclusively toward `/results/custom_runs/`. The official artifacts (`baseline_result.json`, `sandwich_attack_result.json`, `protected_swap_result.json`) have static dependencies.

### Transitioning to Phase 4
The infrastructure seamlessly permits moving into the next stage algorithm validation. Due to the modular parameter mapping enacted during the dashboard development, the upcoming automated 50-run variance testing scripts simply need an array iterations wrapper targeting logic established in `dexInteraction.js`, allowing block variation across time scopes beyond block 19400000.
