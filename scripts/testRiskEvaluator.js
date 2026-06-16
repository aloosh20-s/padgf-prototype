const assert = require('assert');
const { calculateRisk } = require('../src/riskEvaluator');

function runTests() {
    console.log("Starting tests for riskEvaluator.js...\n");

    // Test 1: No output loss, should result in 0 risk
    let metrics = calculateRisk("1.0", "3000", "3000", "30000000000"); // 30 Gwei
    assert.strictEqual(metrics.raw_slippage_deviation, 0);
    assert.strictEqual(metrics.attacker_net_profit_usdc <= 0, true, "Net profit should be <= 0 with no slippage");
    assert.strictEqual(metrics.normalized_risk_score, 0);
    console.log("✔ Test 1 Passed: No slippage => Zero Risk Score");

    // Test 2: Moderate output loss but high gas
    // Reference: 3000, Simulated: 2950 (loss = $50)
    // Gas: 200 Gwei ~ $150 cost
    metrics = calculateRisk("1.0", "3000", "2950", "200000000000");
    assert.strictEqual(metrics.victim_output_loss_usdc, 50);
    assert.strictEqual(metrics.attacker_net_profit_usdc < 0, true, "High gas makes this unprofitable");
    assert.strictEqual(metrics.normalized_risk_score > 0, true, "Should have a non-zero risk score from slippage alone");
    console.log("✔ Test 2 Passed: High Gas makes moderate slippage unprofitable => Non-zero Risk from Slippage");

    // Test 3: Large output loss and low gas (Highly attractive)
    // Reference: 30000 (10 ETH), Simulated: 29000 (loss = $1000, slippage = 3.33%)
    // Gas: 30 Gwei ~ $22.50 cost
    // Default config: poolFeeBps = 30 (0.6% impact), builderBribe = 0.90 (90%)
    metrics = calculateRisk("10.0", "30000", "29000", "30000000000");
    assert.strictEqual(metrics.victim_output_loss_usdc, 1000);
    assert.strictEqual(metrics.attacker_gross_profit_usdc, 1000 * (1 - 0.006)); // 994
    assert.strictEqual(metrics.attacker_net_profit_usdc > 70 && metrics.attacker_net_profit_usdc < 80, true);
    assert.strictEqual(metrics.normalized_risk_score > 0, true);
    console.log("✔ Test 3 Passed: Large loss / Low Gas with defaults (0.3% fee, 90% bribe) => Net Profit: $" + metrics.attacker_net_profit_usdc.toFixed(2));

    // Test 4: High builder bribe (99%) reduces attacker profitability
    metrics = calculateRisk("10.0", "30000", "29000", "30000000000", { builderBribePercentage: 0.99 });
    assert.strictEqual(metrics.attacker_net_profit_usdc < 0, true, "99% bribe makes this unprofitable");
    console.log("✔ Test 4 Passed: High builder bribe (99%) makes net profit negative ($" + metrics.attacker_net_profit_usdc.toFixed(2) + ")");

    // Test 5: Lower builder bribe (50%) increases attacker retained profit
    metrics = calculateRisk("10.0", "30000", "29000", "30000000000", { builderBribePercentage: 0.50 });
    assert.strictEqual(metrics.attacker_net_profit_usdc > 400, true);
    console.log("✔ Test 5 Passed: Lower builder bribe (50%) increases attacker net profit ($" + metrics.attacker_net_profit_usdc.toFixed(2) + ")");

    // Test 6: Higher pool fee (1%) reduces attacker profitability
    metrics = calculateRisk("10.0", "30000", "29000", "30000000000", { poolFeeBps: 100 });
    // 1% fee -> 2% impact -> gross = 980
    assert.strictEqual(metrics.attacker_gross_profit_usdc, 980);
    console.log("✔ Test 6 Passed: Higher pool fee (1%) reduces gross profit to $" + metrics.attacker_gross_profit_usdc.toFixed(2));
    
    // Test 7: Unprofitable scenario despite victim loss
    // Loss = 100, Fee = 0.3%, Bribe = 90%. Gross = 99.4, Retained = 9.94, Gas = 22.50
    metrics = calculateRisk("1.0", "3000", "2900", "30000000000");
    assert.strictEqual(metrics.victim_output_loss_usdc, 100);
    assert.strictEqual(metrics.attacker_net_profit_usdc < 0, true);
    console.log("✔ Test 7 Passed: Victim output loss exists but net profit is negative ($" + metrics.attacker_net_profit_usdc.toFixed(2) + ")");

    console.log("\nAll tests passed successfully!");
}

try {
    runTests();
} catch (error) {
    console.error("Test failed:");
    console.error(error.message);
}
