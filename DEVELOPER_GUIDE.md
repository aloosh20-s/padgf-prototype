# PADGF (PreSend Adaptive Decision Guard Framework) Developer Guide

> [!NOTE]
> This guide is intended for developers, researchers, and technical supervisors working with the **PreSend Adaptive Decision Guard Framework (PADGF)**. It provides a highly comprehensive overview of the architecture, core modules, mathematical logic, and **every core function** within the framework's source code.

---

## 1. Overview
The **PreSend Adaptive Decision Guard Framework (PADGF)** is a localized, client-side algorithmic prototype designed to evaluate decentralized exchange (DEX) transactions against Maximal Extractable Value (MEV) vulnerabilities—specifically sandwich attacks—prior to broadcasting them to the public mempool.

PADGF simulates transactions on a deterministic mainnet fork, dynamically calculates a **Normalized Risk Score**, and autonomously routes the transaction through a **Decision Engine** to **Execute, Delay, or Block** the transaction before capital is exposed to predatory arbitrage bots.

---

## 2. Core Modules & Function Documentation (`/src`)

The `/src` directory contains the mathematical engines and blockchain interfacing logic that powers PADGF.

### 2.1 Provider & Account Management (`providerSetup.js`)
Handles the Hardhat network state. To ensure deterministic testing, it impersonates a whale account and funds it with simulated ETH to cover gas costs for testing.

#### `setupProviderAndSigner(impersonatedAccount)`
- **Parameters:**
  - `impersonatedAccount` *(string)*: The Ethereum address to impersonate (e.g., a known WETH whale).
- **Returns:** A Hardhat `ethers.Signer` object representing the impersonated account.
- **Behavior:** 
  1. Checks for `MAINNET_RPC_URL` in the environment.
  2. Uses `hardhat_impersonateAccount` to take control of the requested address.
  3. Uses `hardhat_setBalance` to inject 10 ETH into the account for gas fees.
  4. Returns the signer for downstream DEX execution.

### 2.2 DEX Interaction (`dexInteraction.js`)
Handles all on-chain communication with the Uniswap V2 Router and ERC20 token contracts.

#### `getTokens(wethAddress, usdcAddress, signer)`
- **Parameters:** Contract addresses for WETH and USDC, and the active `signer`.
- **Returns:** `{ weth, usdc }` initialized `ethers.Contract` objects.

#### `getRouter(routerAddress, signer)`
- **Parameters:** The Uniswap V2 Router address and the active `signer`.
- **Returns:** An initialized `ethers.Contract` for the router.

#### `getQuote(router, amountIn, path)`
- **Parameters:** 
  - `router`: The initialized router contract.
  - `amountIn` *(BigInt)*: The input amount in Wei.
  - `path` *(Array<string>)*: Array of token addresses representing the swap route.
- **Returns:** *(BigInt)* The expected output amount.
- **Behavior:** Calls `getAmountsOut()` on the router and returns the final value. Used to establish the pristine "baseline".

#### `executeSwap(router, weth, amountIn, expectedOutput, path, signer, slippagePercent = 1, gasSpeed = "standard")`
- **Parameters:** Includes routing parameters, expected output for slippage calculation, and `gasSpeed` (`"standard"`, `"fast"`, `"instant"`).
- **Returns:** The transaction `receipt`.
- **Behavior:**
  1. Dynamically calculates base network gas fees using `getFeeData()`.
  2. Multiplies gas fees based on the `gasSpeed` modifier (1.5x for fast, 2.5x for instant).
  3. Executes `approve()` on the WETH contract.
  4. Calculates `amountOutMin` strictly based on the user's `slippagePercent`.
  5. Executes `swapExactTokensForTokens` with a 20-minute deadline.

### 2.3 Risk Evaluator (`riskEvaluator.js`)
The mathematical brain of the framework. Evaluates pre-broadcast risk by estimating the economic incentive for an attacker.

#### `calculateRisk(victimInputEthStr, referenceOutputStr, simulatedOutputStr, gasPriceWei, config)`
- **Parameters:**
  - `victimInputEthStr`, `referenceOutputStr`, `simulatedOutputStr`: String representations of swap values.
  - `gasPriceWei`: Current network gas price to calculate attacker costs.
  - `config`: Object containing `w1`, `w2` (weights), `builderBribePercentage` (default 0.9), `poolFeeBps` (default 30), and `attackerGasProxy` (default 250k).
- **Returns:** An object containing all calculated metrics, including `raw_slippage_deviation`, `price_impact`, `attacker_net_profit_usdc`, `profitability_ratio`, and the final `normalized_risk_score`.
- **Behavior / Math:**
  1. **Slippage Deviation:** Computes the percentage difference between reference output and simulated output.
  2. **Attacker Gross Profit:** Calculates the value extracted from the victim, deducting standard pool fees.
  3. **Attacker Net Profit:** Deducts the builder bribe (90%) and the gas cost (gas proxy * gas price).
  4. **Normalization:** Caps profitability and slippage ratios between 0.0 and 1.0.
  5. **Final Score (`R`):** Computes `(w1 * normProfit) + (w2 * normSlippage)`.

### 2.4 Decision Engine (`decisionEngine.js`)
Evaluates the Normalized Risk Score against predefined thresholds.

#### `makeDecision(riskScore, thresholds = { tau1: 0.3, tau2: 0.7 })`
- **Parameters:**
  - `riskScore` *(Number)*: Output from `calculateRisk`.
  - `thresholds` *(Object)*: `tau1` (lower bound), `tau2` (upper bound).
- **Returns:** `{ decision, risk_score, reason, execution_allowed }`
- **Behavior:**
  - **R < tau1**: Returns `Execute` (`execution_allowed = true`).
  - **tau1 <= R < tau2**: Returns `Delay` (`execution_allowed = false`).
  - **R >= tau2**: Returns `Block` (`execution_allowed = false`).

### 2.5 Results Logging (`resultLogger.js`)
Manages data persistence.

#### `formatOutput(data)`
- **Parameters:** Raw object containing scenario execution data.
- **Returns:** A strictly formatted object based on whether the `scenario_name` contains "Sandwich", "Protected", or "Baseline".

#### `saveResult(formattedData, fileName = "baseline_result.json")`
- **Behavior:**
  1. Writes the data to a `.json` file in `/results`.
  2. Appends a row to the corresponding `.csv` file (`sandwich_attack_summary.csv`, `protected_swap_summary.csv`, or `baseline_summary.csv`).
  3. If it is a Protected Swap, it dynamically generates a readable Markdown report (`phase3_protected_swap_report.md`).

---

## 3. Experimental Execution Flows (`/scripts`)

The framework relies on isolated state execution via **Hardhat Mainnet Forking** (pinned exactly at block `19400000`). This ensures perfect scientific controls.

1.  **Phase 1: Baseline Swaps (`baseline-swap.js`)**
    Executes `getQuote()` and `executeSwap()` with zero interference to establish a ground-truth benchmark.
2.  **Phase 2: MEV Attack Simulation (`sandwich-attack.js`)**
    Simulates an attacker address front-running the victim (using `executeSwap` to buy WETH->USDC), followed by the victim's trade, followed by the attacker's back-run (USDC->WETH). Calculates the total victim output loss.
3.  **Phase 3: Protected Swaps (`protected-swap.js`)**
    The core pipeline: 
    - Fetches `getQuote()`.
    - Simulates the victim swap via `eth_call` without broadcasting.
    - Passes outputs to `calculateRisk()`.
    - Passes risk score to `makeDecision()`.
    - Automatically skips the actual `executeSwap()` if the decision is `Block` or `Delay`.

---

## 4. Frontend & UI Interfaces (`/dashboard` & `/interface`)

### 4.1 CLI Interface (`interface/cli.js`)
A highly polished terminal interface utilizing `inquirer` for menus, `ora` for loading spinners, `figlet` for ASCII banners, and `cli-table3` for rendering structured output tables directly in the console. Triggers the Hardhat scripts via `child_process.exec`.

### 4.2 Web Dashboard (`dashboard/script.js` & `dashboard/server.js`)
- **`server.js`:** A lightweight vanilla Node.js HTTP server. Serves static files from `/public` and exposes a `/api/results` endpoint that reads the JSON files from the `/results` folder.
- **`script.js`:** The frontend logic. Fetches data from `/api/results` and parses it into HTML tables.
  - **`renderChart(data)` & `renderCustomChart(data)`**: Utilizes **Chart.js** via canvas to map the JSON evaluation outputs into comparative bar graphs (Baseline vs Sandwich vs Protected outputs).
  - **`runPhase(phaseRoute)`**: Triggers endpoints that execute the Hardhat scripts dynamically from the browser.

---

## 5. Constants & Configurations (`src/constants.js`)
*   **WETH & USDC Addresses**: Ensure they match Ethereum Mainnet.
*   **Router Address**: Default is Uniswap V2 (`0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`).
*   **Fork Block**: Set to `19400000` to guarantee deterministic and reproducible state data.

---

## 6. Extending the Framework

If you intend to extend PADGF:
1.  **Custom Risk Models**: Modify the logic inside `src/riskEvaluator.js`. Adjust `w1` and `w2` weights, or incorporate new variables like historical pool volatility.
2.  **New DEX Support**: Add Uniswap V3 or Curve routing in `src/dexInteraction.js`. Ensure you fetch quotes using their respective Quoter contracts, as AMM math differs heavily from V2.
3.  **Automated Delay Queues**: Currently, `Delay` just outputs a recommendation. You can expand `src/decisionEngine.js` to place the transaction into a Redis queue that checks mempool gas conditions every block until `R < tau1`.

---

## 7. How the Attack Happens in the Code (`sandwich-attack.js`)

Phase 2 (`scripts/sandwich-attack.js`) provides empirical proof of MEV vulnerability by explicitly simulating a sandwich attack. Here is exactly how the attack vector is coded and executed on the local Hardhat fork:

1. **State Reset & Setup:** The fork is reset to block `19400000`. The script impersonates a victim (whale) and initializes an attacker account. The attacker is artificially funded with 100 ETH, converting 60 ETH to WETH for the attack. The victim attempts to swap 14 WETH to USDC.
2. **The Front-Run (Attack Step 1):** Before the victim's transaction is executed, the attacker broadcasts a transaction swapping 60 WETH into USDC. This drastically depletes the USDC reserves in the Uniswap V2 liquidity pool, driving up the price of USDC. The attacker intentionally sets a high slippage tolerance (15%) to guarantee their transaction executes.
3. **The Victim Swap (Attack Step 2):** The victim's transaction executes immediately after the front-run. Because the attacker inflated the price of USDC, the victim receives significantly less USDC than their pristine baseline quote, absorbing the financial damage as "slippage."
4. **The Back-Run (Attack Step 3):** The attacker immediately sells all the USDC they acquired in Step 1 back into WETH. Because the victim's swap pushed the price of USDC even higher against WETH, the attacker is able to sell their USDC for a profit, ending up with more WETH than the 60 they started with. 

---

## 8. Languages and Tools Used

The PADGF prototype is built using a modern, JavaScript-centric web3 stack, allowing for rapid iteration and seamless integration between on-chain data and off-chain algorithms.

### Core Languages
*   **JavaScript (ES6+)**: The entire logic of the framework—from the risk evaluation math to the blockchain simulation and frontend dashboard—is written in vanilla JavaScript.
*   **HTML5 & Vanilla CSS**: Used to construct the dashboard interface, intentionally avoiding heavy frameworks to keep the prototype lightweight and focused.

### Blockchain & Web3 Tools
*   **Node.js**: The runtime environment that powers the PADGF backend, the Hardhat node, and the CLI.
*   **Hardhat (`hardhat`)**: A premier Ethereum development environment. Used here specifically for its **Mainnet Forking** capabilities, allowing PADGF to simulate transactions against real Uniswap liquidity pools in a localized, consequence-free environment.
*   **Ethers.js (`ethers` v6)**: A complete Ethereum wallet implementation and utilities library. Used to interact with smart contracts (`getAmountsOut`, `swapExactTokensForTokens`), impersonate accounts, parse token decimals, and format Wei values.

### Presentation & UI Tools
*   **Chart.js**: A powerful canvas-based charting library used on the dashboard frontend to visually map the output disparities between Baseline, Attacked, and Protected swaps.
*   **Inquirer.js (`inquirer`)**: Powers the interactive, menu-driven CLI.
*   **Chalk (`chalk`)**: Used for terminal string styling (color-coding risk levels like Red for Block, Green for Execute).
*   **Ora (`ora`)**: Provides terminal loading spinners during long-running Hardhat simulations.
*   **Figlet (`figlet`)**: Generates the large ASCII art banners in the CLI.
*   **CLI-Table3 (`cli-table3`)**: Renders geometric summary tables in the terminal.
