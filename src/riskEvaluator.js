/**
 * Phase 3 - Risk Evaluator
 * This module calculates the pre-broadcast risk of a transaction
 * based on slippage deviation, price impact, and realistic attacker economics.
 */

function calculateRisk(victimInputEthStr, referenceOutputStr, simulatedOutputStr, gasPriceWei, config = {}) {
    // Configurable parameters for economic math
    const { 
        attackerGasProxy = 250000, 
        extractionEfficiency = 0.85,
        w1 = 0.6, w2 = 0.4 // Weights for normalized_risk_score (Profitability vs Slippage)
    } = config;

    const referenceOutput = Number(referenceOutputStr);
    const simulatedOutput = Number(simulatedOutputStr);
    const inputEth = Number(victimInputEthStr);

    // 1. Output Loss & Slippage Deviation
    const victimOutputLoss = referenceOutput - simulatedOutput;
    let slippageDeviation = 0;
    if (referenceOutput > simulatedOutput && referenceOutput > 0) {
        slippageDeviation = (victimOutputLoss / referenceOutput) * 100;
    }

    // 2. Price Impact Proxy
    const priceImpact = slippageDeviation * 0.85;

    // 3. Attacker Economics Evaluation
    const ethPriceUSDC = inputEth > 0 ? (referenceOutput / inputEth) : 3000;
    const attackerGrossProfitUSDC = victimOutputLoss > 0 ? victimOutputLoss * extractionEfficiency : 0;
    
    // Gas cost mapping
    const gasPriceGwei = Number(gasPriceWei) / 1e9;
    const attackerGasCostEth = (attackerGasProxy * Number(gasPriceWei)) / 1e18;
    const attackerGasCostUSDC = attackerGasCostEth * ethPriceUSDC;

    const attackerNetProfitUSDC = attackerGrossProfitUSDC - attackerGasCostUSDC;

    // 4. Normalized Ratios relative to trade size
    let profitabilityRatio = 0;
    if (referenceOutput > 0 && attackerNetProfitUSDC > 0) {
        profitabilityRatio = (attackerNetProfitUSDC / referenceOutput) * 100; // Expected profit as % of trade out
    }

    // 5. New Normalized Risk Score computation based purely on economic ratios
    // Normalizing assumptions: 
    // - Profitability ratio > 1.0% of trade size is critically high incentive for MEV bots
    // - Slippage > 5% is maximum victim harm
    let normProfit = profitabilityRatio / 1.0;
    if (normProfit > 1.0) normProfit = 1.0;
    if (normProfit < 0.0) normProfit = 0.0;

    let normSlippage = slippageDeviation / 5.0;
    if (normSlippage > 1.0) normSlippage = 1.0;
    if (normSlippage < 0.0) normSlippage = 0.0;

    // The final risk score represents a weighted combination of profitability (incentive) and slippage (impact)
    let riskScore = 0;
    if (attackerNetProfitUSDC > 0) {
        riskScore = (w1 * normProfit) + (w2 * normSlippage);
    }
    if (riskScore > 1.0) riskScore = 1.0;

    return {
        raw_slippage_deviation: slippageDeviation,
        price_impact: priceImpact,
        
        eth_price_estimate: ethPriceUSDC,
        victim_output_loss_usdc: victimOutputLoss,
        attacker_gross_profit_usdc: attackerGrossProfitUSDC,
        attacker_gas_cost_usdc: attackerGasCostUSDC,
        attacker_net_profit_usdc: attackerNetProfitUSDC,
        profitability_ratio: profitabilityRatio,
        
        normalized_risk_score: riskScore
    };
}

module.exports = { calculateRisk };
