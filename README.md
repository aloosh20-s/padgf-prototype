# PreSend Adaptive Decision Guard Framework (PADGF)
**Academic Research Prototype**

## Abstract
The PreSend Adaptive Decision Guard Framework (PADGF) is a client-side algorithmic prototype designed to evaluate decentralized exchange (DEX) transactions against Maximal Extractable Value (MEV) vulnerabilities—specifically sandwich attacks—prior to public mempool broadcast. 

By running localized simulations against the current deterministic blockchain state, PADGF dynamically calculates a Normalized Risk Score ($R = w_1S + w_2P + w_3G$) utilizing slippage deviation, gas sensitivity, and price impact proxies. It then routes the transaction through an autonomous Decision Engine to Execute, Delay, or Block the interaction before capital is exposed to predatory arbitrage bots.

## Directory Structure
- `/scripts`: Core Hardhat execution files for Phase 1, 2, and 3 experiments.
- `/src`: The core PADGF modular logic (`decisionEngine.js`, `riskEvaluator.js`, etc.)
- `/interface`: The Node.js command-line tool.
- `/dashboard`: The localized HTTP server and UI for supervisor demonstrations.
- `/results`: Automatically generated JSON, CSV, and Markdown data outputs for academic evaluation.

## Prerequisites
- **Node.js**: v20 or higher
- **Network**: Internet connection required to fork the Ethereum Mainnet RPC.

## Quick Start (Windows)
For presentation purposes, you do not need to open a code editor. Ensure you are in the project folder and use the provided `.bat` launch scripts:

1. Double click **`Run-PADGF-Dashboard.bat`** to boot the deterministic fork and launch the web interface.
2. Navigate to `http://localhost:3000` to interact with the evaluation matrix.

## Experimental Methodology
This project utilizes perfect state-isolation via Hardhat Mainnet Forking (Pinned at Block: `19400000`). This ensures that the baseline expected output, the simulated attacker extraction margin, and the evaluated protected swap scenarios operate deterministically, establishing a rigorous control group for the research metrics.

---
*Disclaimer: PADGF operates as a pre-broadcast risk framework evaluating exploit exposure probability via simulation. It does not observe parallel live dark-pool mempool behaviour and is not an absolute guarantee of transaction safety.*
