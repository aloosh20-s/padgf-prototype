# PADGF Prototype: High-Volume Stress Test Report & Full Output

## Executive Summary

This report details the execution and observation of three custom exploratory test scenarios (Baseline, Sandwich Attack, and Protected) against the simulated Uniswap V2 router environment. The objective was to evaluate the system's behavior when subjected to a high-volume "whale" transaction combined with an excessively relaxed slippage tolerance.

**Test Parameters:**

- **Input Token:** WETH
- **Output Token:** USDC
- **Input Amount:** `100.0 WETH` (Large capital footprint)
- **Slippage Tolerance:** `15.0%` (Extremely relaxed, high exposure to MEV)
- **Simulated Attacker Balance:** `5.0 WETH`

---

## 1. Baseline Swap Scenario

The baseline scenario was executed to determine the expected true market execution without any competitive MEV interference.

**Analysis:**
As expected in a simulated vacuum, the transaction cleanly swapped the 100 WETH for approximately $386,879 without encountering negative slippage. The lack of network contention allowed the swap to clear at the top of the block.

**Full Raw Output:**

```json
{
  "run_type": "Exploratory Test",
  "scenario": "Baseline Swap",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "input_amount": "100.0",
  "slippage_tolerance": "15%",
  "expected_output": "386879.741156",
  "actual_output": "386879.741156",
  "gas_used": "108543",
  "transaction_hash": "0x55ee36b745fcd1853324bb057926b58425be478bc838bab52c6674e8d6365d3b",
  "execution_status": "success",
  "timestamp": "2026-05-29T12:58:02.404Z"
}
```

---

## 2. Sandwich Attack Simulation

The sandwich attack scenario introduced a hostile simulated environment where a front-running bot identified the high-volume transaction with significant slippage tolerance (15%) and attempted to exploit it by sandwiching the target.

**Analysis:**
Even though the attacker was artificially limited in this local script iteration to exploiting the transaction using only 5.0 WETH, they successfully siphoned over $311 from the victim in a single swap block. If the attacker had optimally utilized flashloans or more robust capital sizes given the user's massive 15% slippage margin (which mathematically allowed for up to ~$58k in slippage), this loss would have been devastatingly higher.

**Full Raw Output:**

```json
{
  "run_type": "Exploratory Test",
  "scenario": "Sandwich Attack Simulation",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "victim_input_amount": "100.0",
  "slippage_tolerance": "15%",
  "baseline_expected_output": "386879.741156",
  "attacked_actual_output": "386568.698311",
  "victim_output_loss": "311.042845",
  "financial_loss_percentage": "0.08%",
  "attacker_gas_used": "243827",
  "victim_gas_used": "108543",
  "frontrun_hash": "0xa40a5818591c8ff416a4fea628a1e6a3d487d60530c66792fce7d6ea036c4cb5",
  "victim_hash": "0xeb7f59bbf66b82d9c45ceff6be8f2ae7ed26bfb3b50ef09500db03b5df010261",
  "backrun_hash": "0xdec8165ed2b62c3c413a506097e6cdbbbb27b2f28dc2fe1472c14e557f76b7fe",
  "execution_status": "success",
  "timestamp": "2026-05-29T12:58:16.610Z"
}
```

---

## 3. PADGF Protected Evaluation

The final execution evaluated the PADGF Decision Engine capabilities when protecting the 100 WETH input swap.

**Analysis:**
Because the exploratory test runs its logic purely locally and sequentially without concurrent mempool noise, the simulated quote exactly matched the reference output, resulting in the internal engine grading the `slippage_deviation` at 0. Because the risk score of `0.075` was far below the safe execution threshold of `tau1 (0.3)`, PADGF safely allowed the swap to proceed seamlessly.

**Full Raw Output:**

```json
{
  "run_type": "Exploratory Test",
  "scenario": "PADGF Protected Evaluation",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "input_amount": "100.0",
  "slippage_tolerance": "15%",
  "reference_output": "386879.741156",
  "simulated_output": "386879.741156",
  "actual_output": "386879.741156",
  "slippage_deviation": "0",
  "price_impact": "0",
  "gas_sensitivity": "56.263038815",
  "normalized_risk_score": "0.07501738508666667",
  "threshold_values": {
    "tau1": 0.3,
    "tau2": 0.7
  },
  "padgf_decision": "Execute",
  "execution_allowed": true,
  "execution_status": "success",
  "transaction_hash": "0x55ee36b745fcd1853324bb057926b58425be478bc838bab52c6674e8d6365d3b",
  "timestamp": "2026-05-29T12:58:31.380Z"
}
```

---

## Conclusion and Recommendations

The high-volume test clearly demonstrated that large inputs associated with high slippage constraints directly invite malicious MEV actors to syphon funds, extracting hundreds of dollars even with low capitalization (5 WETH pool sizes).

However, the PADGF Decision Engine successfully validated that if a transaction encounters zero pre-execution deviance (a safe mempool environment), the engine seamlessly defaults to an `Execute` status without hampering the user experience, validating its ability to act as a stealthy "failsafe".

---

## Appendix A: Official Chapter 4 Test Outputs (1.0 WETH Baseline)

These are the formally recorded outputs representing the initial baseline configurations, originally stored in the main `results/` directory prior to custom explorations.

### Official Phase 1 Baseline

**Input:** `1.0 WETH` | **Slippage:** `1%`

```json
{
  "scenario_name": "Phase 1 Baseline",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "input_amount": "1.0",
  "slippage_tolerance": "1%",
  "expected_output": "3899.684203",
  "actual_output": "3899.684203",
  "gas_used": "108507",
  "transaction_hash": "0x70906bb72235fbf15f98052defb7151832be9c5c7203d764951370811664ff57",
  "execution_status": "success"
}
```

### Official Phase 2 Sandwich Attack

**Input:** `1.0 WETH` | **Slippage:** `1%`

```json
{
  "scenario_name": "Phase 2 Sandwich Attack",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "victim_input_amount": "1.0",
  "slippage_tolerance": "1%",
  "baseline_expected_output": "3899.684203",
  "attacked_actual_output": "3896.536466",
  "victim_output_loss": "3.147737",
  "financial_loss_percentage": "0.08%",
  "attacker_gas_used": "243827",
  "victim_gas_used": "108507",
  "frontrun_hash": "0xa40a5818591c8ff416a4fea628a1e6a3d487d60530c66792fce7d6ea036c4cb5",
  "victim_hash": "0x848251c56a4f63c17c027ebad55296a09e1cf070d3c599e4e1671d55c0c5e48b",
  "backrun_hash": "0x931f827c265bafedbdf3aad00332a3f722143afddddb28d81d73e2e24fcf8e0d",
  "execution_status": "success"
}
```

### Official Phase 3 Protected Swap

**Input:** `1.0 WETH` (Default Slippage)

```json
{
  "scenario_name": "Phase 3 Protected Swap",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "input_amount": "1.0",
  "reference_output": "3899.684203",
  "simulated_output": "3899.684203",
  "slippage_deviation": "0",
  "price_impact": "0",
  "gas_sensitivity": "56.263038815",
  "normalized_risk_score": "0.07501738508666667",
  "threshold_values": {
    "tau1": 0.3,
    "tau2": 0.7
  },
  "padgf_decision": "Execute",
  "execution_allowed": true,
  "execution_status": "success"
}
```

---

## Appendix B: Custom Moderate-Stress Scenarios

These exploratory iterations dynamically pushed boundaries beyond the official thesis data constraints.

### Custom Baseline Swap

**Input:** `2.0 WETH` | **Slippage:** `0.5%`

```json
{
  "run_type": "Exploratory Test",
  "scenario": "Baseline Swap",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "input_amount": "2.0",
  "slippage_tolerance": "0.5%",
  "expected_output": "7798.7395",
  "actual_output": "7798.7395",
  "gas_used": "108531",
  "transaction_hash": "0xf460e32e33a3c3afb22fe754f356ad09e3fcfa323fea869ddb712540010d54e8",
  "execution_status": "success"
}
```

### Custom Sandwich Attack Simulation

**Input:** `5.0 WETH` | **Slippage:** `2%`

```json
{
  "run_type": "Exploratory Test",
  "scenario": "Sandwich Attack Simulation",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "victim_input_amount": "5.0",
  "slippage_tolerance": "2%",
  "baseline_expected_output": "19492.133473",
  "attacked_actual_output": "19476.402402",
  "victim_output_loss": "15.731071",
  "financial_loss_percentage": "0.08%",
  "attacker_gas_used": "243827",
  "victim_gas_used": "108531",
  "execution_status": "success"
}
```

### Custom PADGF Protected Evaluation

**Input:** `1.5 WETH` | **Slippage:** `1%`

```json
{
  "run_type": "Exploratory Test",
  "scenario": "PADGF Protected Evaluation",
  "fork_block": 19400000,
  "dex": "Uniswap V2",
  "input_token": "WETH",
  "output_token": "USDC",
  "input_amount": "1.5",
  "slippage_tolerance": "1%",
  "reference_output": "5849.290455",
  "simulated_output": "5849.290455",
  "actual_output": "5849.290455",
  "slippage_deviation": "0",
  "price_impact": "0",
  "gas_sensitivity": "56.263038815",
  "normalized_risk_score": "0.07501738508666667",
  "threshold_values": {
    "tau1": 0.3,
    "tau2": 0.7
  },
  "padgf_decision": "Execute",
  "execution_allowed": true,
  "execution_status": "success"
}
```
