# PADGF Framework: comprehensive Explanation & Supervisor Presentation Guide

This document is designed to help you thoroughly understand the frameworks and architecture of the **Proactive And Dynamic Gas Fee (PADGF) Prototype**, and provides clear, structured talking points for explaining the system to your academic supervisor.

---

## Part 1: Frameworks & Architecture Breakdown

The PADGF framework is divided into three primary layers. You can explain this to your supervisor as a **"Full-Stack Blockchain Simulation Environment."**

### 1. The Core Blockchain Simulation Layer (Hardhat)
**What it is:** Hardhat is an industry-standard Ethereum development environment. 
**Why we used it:** It allows us to create a local, controlled "sandbox" of the Ethereum blockchain.
* **Where to find the code:** Configured in `hardhat.config.js` (Root directory).
**Key Features to highlight:**
* **Mainnet Forking:** Instead of using fake data, Hardhat allows us to "fork" (copy) the real Ethereum mainnet at a specific block (Block `19400000`). This ensures our sandwich attack simulations use real, historical liquidity pool data (Uniswap V2) rather than theoretical approximations.

### 2. The Blockchain Interaction Layer (Ethers.js)
**What it is:** A JavaScript library that allows our code to talk to the blockchain.
**Why we used it:** Smart contracts speak byte-code; Ethers.js translates our JavaScript commands into a format the blockchain understands.
* **Where to find the code:** The wrapper logic resides in `src/dexInteraction.js` (specifically `getQuote()` and `executeSwap()` functions).
**Key Features to highlight:**
* It handles calculating exact gas limits, estimating live fee data (`getFeeData()`), and constructing the transactions.

### 3. The Interactive Dashboard & Evaluation Layer (Node.js + Vanilla Web)
**What it is:** A lightweight web application consisting of a custom Node.js server and an HTML/CSS/JS frontend.
* **Where to find the Node backend code:** `dashboard/server.js` (Hosts API routes like `/api/run/user-driven-evaluate`).
* **Where to find the User Interface code:** `dashboard/public/user-driven.html` and `dashboard/public/script.js` (Frontend logic).
**Key Features to highlight:**
* **Node.js Server:** Acts as the bridge. When a user clicks a button on the UI, the Node server executes the heavy Hardhat simulation scripts in the background and returns the results.
* **User-Driven Exploratory Mode:** Proves that the PADGF logic works not just for a static thesis test, but dynamically.

---

## Part 2: How PADGF Evaluation Works (The Core Logic)

When explaining the "secret sauce" (the decision engine) to your supervisor, use this 3-step breakdown:

1. **Information Gathering:** 
   Before sending a transaction, PADGF calculates a **Reference Quote** (what the user expects) and a **Simulated Quote** (what they would actually get).
   * **Code Location:** `scripts/user-driven-demo.js` captures these values prior to execution using the `getQuote` function.
2. **Risk Scoring (The Math):** 
   The system calculates the *Slippage Deviation* and *Price Impact*, factoring in the *Gas Sensitivity*. These metrics are combined into a **Normalized Risk Score** (ranging from 0.0 to 1.0).
   * **Code Location:** The core math engine resides completely in `src/riskEvaluator.js` inside the `calculateRisk()` function.
3. **The Threshold Decision (tau1 and tau2):**
   * If Score < `0.3` (Low Risk): Execute the transaction.
   * If `0.3` ≤ Score < `0.7` (Moderate Risk): Delay the transaction dynamically based on the score (e.g., waiting 15–45 seconds). 
     * **Code Location for Dynamic Delay Engine:** `dashboard/public/script.js` inside the `udStartDelay()` and `runUserDrivenEvaluate()` functions.
   * If Score ≥ `0.7` (High Risk): Alert the user and warn them to block/cancel the transaction entirely.

---

## Part 3: Simulating the Sandwich Attack in Code

To confidently explain exactly how we induce and prove the sandwich attack mechanism inside our framework, point your supervisor to **`scripts/sandwich-attack.js`** (and the high-stress dynamic induction in `scripts/user-driven-demo.js`). 

A sandwich attack requires manipulating the automated market maker (AMM) pricing equation ($x \times y = k$). Our code strictly executes this into three distinct transaction phases:

**1. The Front-Run (The Attacker Buys)**
The attacker detects the victim's pending large transaction and intentionally buys a massive amount of the asset (e.g., swapping 5.0 WETH for USDC). This artificially shifts the liquidity pool, driving the price of USDC sky-high.
```javascript
// Step 1: Attacker Front-run 
// Attacker uses high gas fee to guarantee their transaction executes BEFORE the victim
const frontrunTx = await executeSwap(
    attackerRouter, attackerWeth, attackerAmountIn, attackerQuoteWei, path,
    attackerSigner, attackerSlippage 
);
```

**2. The Victim Swap (The Trap)**
The victim's transaction executes next. Because the pool is manipulated, the victim receives significantly less USDC than they originally intended. Their high *Slippage Tolerance* allows the contract to accept this terrible trade instead of reverting.
```javascript
// Step 2: Victim Swap
// Victim gets less output because the attacker exhausted the cheap liquidity
const victimTx = await executeSwap(
    victimRouter, victimWeth, victimAmountIn, baselineQuoteWei, path, 
    victimSigner, slippageTolerance
);
```

**3. The Back-Run (The Attacker Profits)**
Immediately in the same block (or right after), the attacker sells all the USDC they bought in Step 1 back to WETH at the newly inflated price, capturing a risk-free profit derived purely from the victim's capital loss.
```javascript
// Step 3: Attacker Back-run
// Attacker dumps USDC back to WETH to secure the profit
const backrunTx = await executeSwap(
    attackerRouter, attackerUsdc, attackerUsdcBalance, backrunQuoteWei, reversePath, 
    attackerSigner, attackerSlippage
);
```

---

## Part 4: Supervisor Presentation Guide & Talking Points

When presenting this to your supervisor, follow this narrative arc to ensure they understand the academic and practical value of your work.

### 🔴 Problem Statement (The Hook)
> *"Professor, currently on decentralized exchanges, users submit transactions blindly. If a transaction is large, it gets targeted by bots in the mempool for a 'Sandwich Attack.' The user suffers pure financial loss through manipulated slippage, and standard wallets do nothing to warn them."*

### 🟡 Our Solution (The PADGF Framework)
> *"To solve this, we built the PADGF framework. We combined a simulated Ethereum mainnet (Hardhat) with an interactive dashboard. Instead of executing blindly, PADGF intercepts the transaction, simulates the execution against live mempool conditions, and calculates a mathematical risk score."*

### 🟢 The Demonstration (Show, Don't Just Tell)
1. **Show the Thesis Result (Phase 1, 2, 3):** 
   > *"Here is the baseline, compared to a successful sandwich attack where the user loses money. Finally, here is PADGF successfully predicting and protecting against that same attack."*
2. **Show the Exploratory Mode (The 'Wow' Factor):** 
   > *"To prove this isn't hardcoded, we built a realistic Wallet Demo mode. If I input 1 ETH (low risk), it executes normally. But watch what happens if I input 50 ETH. The PADGF risk evaluator detects the high slippage deviation, calculates the dynamic gas conditions, flags it as High Risk, and dynamically intercepts it, asking the user to delay or cancel."*

### 🔵 Key Academic Defense Points (Anticipating Questions)
* **Q: "Why didn't you use testnets like Goerli or Sepolia?"**
  * **A:** *"Testnets lack the realistic liquidity depth and bot activity of the actual market. By using Hardhat Mainnet Forking, our prototype interacts with the genuine Uniswap V2 smart contracts, yielding highly accurate, research-grade financial data."*
* **Q: "How did you calculate the delay time?"**
  * **A:** *"We implemented a linear mathematical function tied to Ethereum's 12-second block time. The delay isn't random; it scales dynamically from 15 to 45 seconds strictly based on PADGF's normalized risk score. Higher risk mathematically mandates a longer delay to let the targeted block pass."*
* **Q: "Is this heavy or bloated?"**
  * **A:** *"No, we specifically chose to use native Node.js and Vanilla JavaScript for the frontend. We avoided heavy frameworks like React or large databases to prove that PADGF logic can be implemented as a lightweight middleware, perfect for integration into existing wallets like MetaMask."*
