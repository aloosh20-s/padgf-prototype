# PreSend Adaptive Decision Guard Framework (PADGF) Implementation Report

This comprehensive document outlines the end-to-end practical execution and system enhancements implemented for the **PADGF Prototype** from Phase 1 through Phase 3, culminating in the advanced interactive logic integrated into the presentation Dashboard.

---

## Part I: The Core Architecture (Phases 1-3)

### Phase 1: Baseline Ground Truth Environment
Our foremost objective was establishing a reproducible, sterile, deterministic environment—a "control group"—against which all sandwich attack scenarios could be academically measured.
* **Mainnet Forking**: We configured Hardhat to fork the Ethereum Mainnet natively pinned specifically at **Block 19400000**.
* **Simulation Mechanics**: Impersonated an account with a high liquid balance to circumvent fund gating, providing simulated gas execution and routing.
* **The Metric**: We mapped a base, non-adversarial execution route exchanging **1.0 WETH to USDC** on Uniswap V2 operating with standard 1% mathematical slippage bounds. Generating deterministic outcomes logged explicitly to `baseline_result.json`.

### Phase 2: Sandwich Attacker Simulation
With our control group constructed, we engineered an active local adversarial model designed to simulate MEV predatory parameters.
* **Mempool Monitoring & Front-Running**: Constructed programmatic execution layers allowing a simulated "attacker" to identify the victim's pending 1.0 WETH payload, executing a massive preemptive WETH → USDC buy order to drive up the asset's reserve limits.
* **Loss Procurement (The Attack)**: As the victim transacts strictly within their 1% baseline boundary, they inadvertently absorb the manufactured price impact.
* **Back-Running (The Extraction)**: The script concludes with the attacker liquidating the newly acquired assets immediately back against the impacted pool balances. Logging conclusive financial degradation (slippage extraction) natively to `sandwich_attack_result.json`.

### Phase 3: The PreSend Adaptive Decision Guard (PADGF)
This phase served as the implementation of your thesis's central countermeasure.
* **Algorithmic Evaluation Model**: Engineered a strict pre-broadcast simulation framework parsing `raw_slippage_deviation`, `raw_price_impact`, and `raw_gas_sensitivity`.
* **Execution Normalization Engine**: Aggregated these raw signals into a dynamically governed `normalized_risk_score`.
* **The Judgment Matrix**: Depending on predefined tolerances, the system accurately outputs a binary decision variable mapping to Execute, Delay, or Block *before* the transaction is ever forwarded to a public mempool router, successfully circumventing measured threats entirely. Outcomes are verified natively in `protected_swap_result.json`.

---

## Part II: Supervisor Dashboard Enhancements

To shift the execution out of standard terminals into a medium optimized for research validation and thesis presentations, we overhauled the ecosystem with an interactive web dashboard framework.

### 1. Robust Methodological Segregation
* **Two-Tier Engine**: Structured the UI completely segmenting **"Official Thesis Scenarios"** directly from **"Exploratory Tests"**. 
* **Data Insulation Protocol**: Any input manipulating amounts (0.5 to 5.0 WETH) or slippage controls executes through an isolated bespoke backend API (`/api/run/custom`), compiling entirely segregated file structures (`results/custom_runs/`). This critically secures your official findings from accidental overwriting.

### 2. Live API Middleware
* **Seamless Shell Interface**: Engineered the lightweight `server.js` framework utilizing Node `child_process` hooks mapping dynamic Javascript UI JSON outputs functionally across the server boundaries directly into the deterministic Hardhat processes asynchronously.

### 3. "About the Team" Interactive Module
* Designed a beautifully customized pop-up modal directly accessible from the main header dedicated honoring the engineers defining this project.
* The framework accommodates: Alaa Saleh, Abd Al_Hakeem, Anas Fahly, AbdAlazez Alshrmany, Ammar Al-ward, Mohammed Ameen, Amro Alagbry.
* **Interactive Modularity**: Implemented HTML5 `localStorage` architecture tethered seamlessly alongside JS `FileReader()` capabilities. This allows the presentating team to simply click dynamically on their profile components during a live-demo environment to upload pictures from their PCs and directly type their bios—without ever writing code or reloading the backend databases!

---

### Conclusion & System Standing
As it stands, the implementation translates deeply theoretical MEV defense mitigation directly onto provable, reproducible, and highly visible interactive infrastructure ready for rigorous mathematical presentation and academic demonstration.
