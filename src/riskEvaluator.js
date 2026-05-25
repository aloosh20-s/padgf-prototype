/**
 * Phase 3 - Risk Evaluator
 * This module calculates the pre-broadcast risk of a transaction
 * based on slippage deviation, price impact proxy, and gas sensitivity.
 */

function calculateRisk(referenceOutputStr, simulatedOutputStr, gasPriceWei, config = {}) {
    // Default weights for the formula: R = w1*S + w2*P + w3*G
    const { w1 = 0.5, w2 = 0.3, w3 = 0.2 } = config;

    const referenceOutput = Number(referenceOutputStr);
    const simulatedOutput = Number(simulatedOutputStr);

    // 1. Slippage Deviation (S)
    // Percentage difference between ideal referenced quote and current simulation
    let slippageDeviation = 0;
    if (referenceOutput > simulatedOutput) {
        slippageDeviation = ((referenceOutput - simulatedOutput) / referenceOutput) * 100;
    }

    // Normalize S (Cap at 5% deviation)
    const MAX_SLIPPAGE_PERCENT = 5.0;
    let normS = slippageDeviation / MAX_SLIPPAGE_PERCENT;
    if (normS > 1.0) normS = 1.0;
    if (normS < 0.0) normS = 0.0;

    // 2. Price Impact Proxy (P)
    // For this prototype, we mock price impact proportional to the observed slippage
    // In production, this would compare input size to direct pool liquidity reserves.
    const priceImpact = slippageDeviation * 0.85; 
    const MAX_IMPACT_PERCENT = 5.0;
    let normP = priceImpact / MAX_IMPACT_PERCENT;
    if (normP > 1.0) normP = 1.0;
    if (normP < 0.0) normP = 0.0;

    // 3. Gas Sensitivity (G)
    // Normalize against a high gas phase (e.g. 150 Gwei = max risk)
    const MAX_GAS_GWEI = 150;
    const gasPriceGwei = Number(gasPriceWei) / 1e9;
    let normG = gasPriceGwei / MAX_GAS_GWEI;
    if (normG > 1.0) normG = 1.0;
    if (normG < 0.0) normG = 0.0;

    // 4. Normalized Risk Score (R)
    const riskScore = (w1 * normS) + (w2 * normP) + (w3 * normG);

    return {
        raw_slippage_deviation: slippageDeviation,
        normalized_slippage: normS,
        raw_price_impact: priceImpact,
        normalized_price_impact: normP,
        raw_gas_sensitivity: gasPriceGwei,
        normalized_gas_sensitivity: normG,
        weights: { w1, w2, w3 },
        normalized_risk_score: riskScore
    };
}

module.exports = { calculateRisk };
