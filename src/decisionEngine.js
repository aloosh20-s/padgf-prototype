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
    let reason = "Risk score is below safe threshold. Environment is stable for execution.";

    if (riskScore >= tau2) {
        decision = "Block";
        allowed = false;
        reason = "Critical risk detected. The transaction exhibits high-risk execution characteristics associated with sandwich attack exposure.";
    } else if (riskScore >= tau1 && riskScore < tau2) {
        decision = "Delay";
        allowed = false;
        reason = "Elevated risk detected. Postponing pre-broadcast transaction parameters execution to next block.";
    }

    return {
        decision: decision,
        risk_score: riskScore,
        thresholds: thresholds,
        reason: reason,
        execution_allowed: allowed
    };
}

module.exports = { makeDecision };
