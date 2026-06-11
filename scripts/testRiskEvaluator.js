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
    assert.strictEqual(metrics.normalized_risk_score, 0);
    console.log("✔ Test 2 Passed: High Gas makes moderate slippage unprofitable => Zero Risk");

    // Test 3: Large output loss and low gas (Highly attractive)
    // Reference: 30000 (10 ETH), Simulated: 29000 (loss = $1000, slippage = 3.33%)
    // Gas: 30 Gwei ~ $22.50 cost
    metrics = calculateRisk("10.0", "30000", "29000", "30000000000");
    assert.strictEqual(metrics.victim_output_loss_usdc, 1000);
    assert.strictEqual(metrics.attacker_gross_profit_usdc, 850); // 85% extraction
    assert.strictEqual(metrics.attacker_net_profit_usdc > 800, true);
    assert.strictEqual(metrics.normalized_risk_score > 0.8, true, "Should yield a critical risk score");
    console.log("✔ Test 3 Passed: Large loss / Low Gas => Critical Risk Score (" + metrics.normalized_risk_score.toFixed(2) + ")");

    // Test 4: Custom config overrides
    metrics = calculateRisk("10.0", "30000", "29000", "30000000000", { extractionEfficiency: 1.0 });
    assert.strictEqual(metrics.attacker_gross_profit_usdc, 1000);
    console.log("✔ Test 4 Passed: Config extractionEfficiency applied correctly");

    console.log("\nAll tests passed successfully!");
}

try {
    runTests();
} catch (error) {
    console.error("Test failed:");
    console.error(error.message);
}
