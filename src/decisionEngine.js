/**
 * Phase 3 - Decision Engine
 * Threshold-based logic to evaluate normalized risk scores.
 * R < tau1 -> Execute
 * tau1 <= R < tau2 -> Delay
 * R >= tau2 -> Block
 */

function makeDecision(riskScore, thresholds = { tau1: 0.3, tau2: 0.7 }) {
  const { tau1, tau2 } = thresholds;

  let decision = "Execute";
  let allowed = true;
  let reason =
    "Execution deemed safe: Attacker profitability relative to trade size is negligible or zero.";

  if (riskScore >= tau2) {
    decision = "Block";
    allowed = false;
    reason =
      "Critical risk detected. Attacker net profitability is highly attractive, exposing the swap to guaranteed economic extraction.";
  } else if (riskScore >= tau1 && riskScore < tau2) {
    decision = "Delay";
    allowed = false;
    reason =
      "Elevated risk detected. Attacker has marginal profitability. Delay recommended until mempool conditions or gas prices shift.";
  }

  return {
    decision: decision,
    risk_score: riskScore,
    thresholds: thresholds,
    reason: reason,
    execution_allowed: allowed,
  };
}

module.exports = { makeDecision };
