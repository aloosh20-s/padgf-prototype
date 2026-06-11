const fs = require('fs');
const path = require('path');

function formatOutput(data) {
    if (data.scenario_name && data.scenario_name.includes("Sandwich")) {
       return {
            scenario_name: data.scenario_name,
            fork_block: data.fork_block,
            dex: data.dex || "Uniswap V2",
            input_token: data.input_token,
            output_token: data.output_token,
            victim_input_amount: data.victim_input_amount,
            slippage_tolerance: data.slippage_tolerance,
            baseline_expected_output: data.baseline_expected_output,
            attacked_actual_output: data.attacked_actual_output,
            victim_output_loss: data.victim_output_loss,
            financial_loss_percentage: data.financial_loss_percentage,
            attacker_gas_used: data.attacker_gas_used,
            victim_gas_used: data.victim_gas_used,
            frontrun_hash: data.frontrun_hash,
            victim_hash: data.victim_hash,
            backrun_hash: data.backrun_hash,
            execution_status: data.execution_status,
            timestamp: new Date().toISOString()
        }; 
    } else if (data.scenario_name && data.scenario_name.includes("Protected")) {
         return {
            scenario_name: data.scenario_name,
            fork_block: data.fork_block,
            dex: data.dex || "Uniswap V2",
            input_token: data.input_token,
            output_token: data.output_token,
            input_amount: data.input_amount,
            reference_output: data.reference_output,
            simulated_output: data.simulated_output,
            slippage_deviation: data.slippage_deviation,
            price_impact: data.price_impact,
            normalized_risk_score: data.normalized_risk_score,
            threshold_values: data.threshold_values,
            padgf_decision: data.padgf_decision,
            execution_allowed: data.execution_allowed,
            execution_status: data.execution_status,
            transaction_hash: data.transaction_hash,
            timestamp: new Date().toISOString()
        }; 
    }

    return {
        scenario_name: data.scenario_name || "Baseline Swap",
        fork_block: data.fork_block,
        dex: data.dex || "Uniswap V2",
        input_token: data.input_token,
        output_token: data.output_token,
        input_amount: data.input_amount,
        slippage_tolerance: data.slippage_tolerance,
        expected_output: data.expected_output,
        actual_output: data.actual_output,
        gas_used: data.gas_used,
        transaction_hash: data.transaction_hash,
        execution_status: data.execution_status,
        timestamp: new Date().toISOString()
    };
}

function saveResult(formattedData, fileName = 'baseline_result.json') {
    const resultsDir = path.join(__dirname, '..', 'results');
    
    // Ensure results directory exists
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    // Write primary JSON output
    const filePath = path.join(resultsDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(formattedData, null, 2));

    let csvPath;
    let header;
    let row;
    
    if (formattedData.scenario_name && formattedData.scenario_name.includes("Sandwich")) {
        csvPath = path.join(resultsDir, 'sandwich_attack_summary.csv');
        header = "scenario_name,fork_block,dex,input_token,output_token,victim_input_amount,baseline_expected_output,attacked_actual_output,victim_output_loss,financial_loss_percentage,attacker_gas_used,status\n";
        row = `${formattedData.scenario_name},${formattedData.fork_block},${formattedData.dex},${formattedData.input_token},${formattedData.output_token},${formattedData.victim_input_amount},${formattedData.baseline_expected_output},${formattedData.attacked_actual_output},${formattedData.victim_output_loss},${formattedData.financial_loss_percentage},${formattedData.attacker_gas_used},${formattedData.execution_status}\n`;
    } else if (formattedData.scenario_name && formattedData.scenario_name.includes("Protected")) {
        csvPath = path.join(resultsDir, 'protected_swap_summary.csv');
        header = "scenario_name,fork_block,dex,input_token,output_token,input_amount,reference_output,simulated_output,slippage_deviation,padgf_decision,execution_allowed,status\n";
        row = `${formattedData.scenario_name},${formattedData.fork_block},${formattedData.dex},${formattedData.input_token},${formattedData.output_token},${formattedData.input_amount},${formattedData.reference_output},${formattedData.simulated_output},${formattedData.slippage_deviation},${formattedData.padgf_decision},${formattedData.execution_allowed},${formattedData.execution_status}\n`;
        
        // Generate Markdown Report
        const mdPath = path.join(resultsDir, 'phase3_protected_swap_report.md');
        const mdContent = `# PADGF Phase 3: Protected Swap Report

## Environment Details
- **Scenario Name:** ${formattedData.scenario_name}
- **Fork Block:** ${formattedData.fork_block} (Ethereum Mainnet)
- **Exchange (DEX):** ${formattedData.dex}
- **Token Pair:** ${formattedData.input_token} to ${formattedData.output_token}
- **Input Amount:** ${formattedData.input_amount} ${formattedData.input_token}

## Risk Indicators (Simulation Output)
- **Reference Output Expected:** ${formattedData.reference_output} ${formattedData.output_token}
- **Simulated Execution Output:** ${formattedData.simulated_output} ${formattedData.output_token}
- **Slippage Deviation:** ${parseFloat(formattedData.slippage_deviation).toFixed(4)}%
- **Price Impact Proxy:** ${parseFloat(formattedData.price_impact).toFixed(4)}%
- **Normalized Risk Score:** **${parseFloat(formattedData.normalized_risk_score).toFixed(4)}**

## PADGF Decision
- **Thresholds Used:** tau1 = ${formattedData.threshold_values.tau1}, tau2 = ${formattedData.threshold_values.tau2}
- **Decision:** **${formattedData.padgf_decision}**
- **Execution Allowed:** ${formattedData.execution_allowed}
- **Transaction Hash:** ${formattedData.transaction_hash || 'N/A (Blocked/Delayed)'}

### Interpretation
The PADGF risk evaluator successfully modeled the pre-broadcast transaction parameters before the transaction enters the public mempool. By analyzing slippage deviation and potential price impact, it derived a normalized risk score of ${parseFloat(formattedData.normalized_risk_score).toFixed(4)}. Evaluated against the threshold set points, the decision engine determined the transaction should result in: **${formattedData.padgf_decision}**. 
*(Note: PADGF provides a pre-broadcast risk evaluation and decision framework, not a guarantee of MEV prevention).*
`;
        fs.writeFileSync(mdPath, mdContent);
    } else {
        csvPath = path.join(resultsDir, 'baseline_summary.csv');
        header = "scenario_name,fork_block,dex,input_token,output_token,input_amount,expected_output,actual_output,gas_used,status\n";
        row = `${formattedData.scenario_name},${formattedData.fork_block},${formattedData.dex},${formattedData.input_token},${formattedData.output_token},${formattedData.input_amount},${formattedData.expected_output},${formattedData.actual_output},${formattedData.gas_used},${formattedData.execution_status}\n`;
    }

    // Check if the append target file doesn't exist to write header
    if (!fs.existsSync(csvPath)) {
        fs.writeFileSync(csvPath, header + row);
    } else {
        fs.appendFileSync(csvPath, row);
    }
    
    // Log info
    console.log(`\nResults saved to: ${filePath}`);
    console.log(`Summary appended to: ${csvPath}\n`);

    // Verify file actually saved
    if (!fs.existsSync(filePath)) {
        throw new Error("Failed to save result file.");
    }
}

module.exports = { formatOutput, saveResult };
