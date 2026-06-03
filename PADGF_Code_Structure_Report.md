# PADGF Prototype: Code Structure & Functionality Report

This report outlines the structural organization of the **PADGF (Proactive And Dynamic Gas Fee) Prototype** codebase. It provides a directory-by-directory breakdown and explains the specific function and purpose of each core file, ensuring clear navigation for development and review.

## 🗺️ Codebase Map
```text
padgf-prototype/
├── src/                        # Core system logic
│   ├── constants.js            # Configuration & Contract ABIs
│   ├── providerSetup.js        # Ethereum node & signer initialization
│   ├── dexInteraction.js       # Exchange interaction layer
│   ├── riskEvaluator.js        # Mathematical risk scoring engine
│   ├── decisionEngine.js       # Transaction approval/delay/reject logic
│   └── resultLogger.js         # JSON/Text evaluation data logging
├── scripts/                    # Hardhat execution scenarios
│   ├── baseline-swap.js        # Control test (No PADGF)
│   ├── sandwich-attack.js      # MEV exploit simulation
│   ├── protected-swap.js       # Active PADGF defense simulation
│   ├── user-driven-demo.js     # Backend for localized UI testing
│   └── custom-run.js           # Exploratory parametric testing 
├── dashboard/                  # Web Dashboard Layer
│   ├── server.js               # Node.js HTTP API & execution server
│   └── public/                 # Front-end Assets
│       ├── index.html          # Main UI structure
│       ├── user-driven.html    # Interactive testing structure
│       ├── thesis.html         # Official thesis scenarios structure
│       ├── custom.html         # Custom exploratory runs structure
│       ├── about.html          # Team informational page
│       ├── script.js           # Front-end logic & API fetching
│       ├── main.css            # Core UI styling rules
│       ├── style.css           # Additional UI enhancements
│       └── images/             # UI images and assets
├── interface/                  
│   └── cli.js                  # Command line interface utility
├── results/                    # Directory where JSON output data is saved (e.g. thesis & custom runs)
├── Run-PADGF-CLI.bat           # Windows shortcut to run the CLI
├── Run-PADGF-Dashboard.bat     # Windows shortcut to start the dashboard
├── hardhat.config.js           # Hardhat network environment config
├── package.json                # Project dependencies (ethers, etc.)
└── *.md / *.txt                # Documentation (Technical Reports) and raw execution logs
```

---

## 📁 1. Core System Logic (`src/`)
The `src/` directory contains the foundational, modular, and reusable JavaScript logic powering the PADGF prototype's interactions, evaluations, and data processing.

* **`constants.js`**
  **Function:** Acts as the central configuration file. It stores constant values such as Decentralized Exchange (DEX) router contract addresses (e.g., Uniswap V2 Router), essential token addresses (like WETH), and Contract ABIs (Application Binary Interfaces) needed for Ethers.js to communicate with smart contracts.

* **`providerSetup.js`**
  **Function:** Responsible for orchestrating the connection to the local Ethereum node simulation (provided by Hardhat). It sets up Ethers.js providers and initializes the "Signers" (simulated wallets/users) that will execute the transactions. 

* **`dexInteraction.js`**
  **Function:** Serves as the primary operational layer for communicating with the exchange. It abstracts complex on-chain transaction flows including formatting trade paths, reading output values, and securely submitting swaps/token approvals to the network.

* **`riskEvaluator.js`**
  **Function:** The mathematical core of the system. It calculates the theoretical "Risk Score" of a transaction by comparing user slippage tolerances against current liquidity data, mempool state approximations, and price impacts, outputting a definitive risk metric (Low, Moderate, High).

* **`decisionEngine.js`**
  **Function:** The reactive layer that ingests the calculated risk from the `riskEvaluator.js`. It utilizes pre-defined algorithmic logic to decide the fate of a transaction—whether to immediately approve it, introduce an automated dynamic delay to reduce the chance of sandwich bots succeeding, or reject the transaction altogether.

* **`resultLogger.js`**
  **Function:** Handles the persistent storage of evaluation data. It cleanly formats and outputs simulation results and risk metrics into structured JSON and text files (stored in the `results/` directory) for subsequent analysis or visualization by the dashboard.

---

## 📁 2. Execution & Simulation Scripts (`scripts/`)
Located within the `scripts/` folder, these files are designed to be run via the Hardhat environment (`npx hardhat run ...`). They orchestrate end-to-end scenarios mimicking genuine mainnet network conditions.

* **`baseline-swap.js`**
  **Function:** Executes a standard, unprotected token swap. It serves as the "Control" variable to benchmark standard gas costs and transaction workflows without any PADGF intervention.

* **`sandwich-attack.js`**
  **Function:** Simulates a malicious MEV (Miner Extractable Value) sandwich attack. It coordinates multiple signers (the attacker front-running, the victim's trade, and the attacker's back-running trade) to demonstrate how unmodified transactions are exploited for profit.

* **`protected-swap.js`**
  **Function:** Simulates the same scenario as the baseline swap but with the PADGF defensive mechanics actively running to showcase automated protection mechanisms.

* **`user-driven-demo.js`**
  **Function:** Provides the backend logic for localized, user-interactive testing. It works in tandem with the dashboard, processing custom input amounts and slippage settings defined dynamically by the user and running an evaluated, step-by-step risk assessment.

* **`custom-run.js`**
  **Function:** Similar to the demo, it is dedicated to facilitating distinct exploratory operations and custom parametric testing paths decoupled from the primary rigid thesis simulations.

---

## 📁 3. Web Dashboard Layer (`dashboard/`)
The interactive interface allowing supervisors and users to execute scripts and review data dynamically.

* **`server.js`**
  **Function:** A lightweight custom Node.js HTTP server. It surfaces the web frontend to the browser, establishes an API layer (`/api/...`) that the frontend can call, and utilizes Node's `child_process` to securely trigger the Hardhat scripts in the background based on UI interactions.

### 📁 Frontend Assets (`dashboard/public/`)
* **`index.html`, `user-driven.html`, etc.**
  **Function:** The semantic HTML backbone structuring the various modules of the supervisor dashboard, framing data tables, and forms.
* **`script.js`**
  **Function:** The core client-side logic. It contains the essential fetch commands to Ping the backend Node server, dynamically retrieve JSON results logging, and render the reactive UI components (such as countdowns, charts, and gas calculations) directly in the browser.
* **`style.css` & `main.css`**
  **Function:** Governs the aesthetic rules (layout, styling, animations) that grant the dashboard its polished, professional look.

---

### Additional Root Dependencies
* **`hardhat.config.js`**: Instructs the Hardhat framework on network configurations (like the local mainnet fork setup).
* **`.bat` Scripts (`Run-PADGF-...`)**: Windows executable scripts to simplify the local startup of the environment for non-technical users.
* **`package.json`**: Tracks external Node.js dependencies (e.g., Ethers, Hardhat) and run scripts necessary to install and boot the project locally.
