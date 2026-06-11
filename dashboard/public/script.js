// =========================================================
//  PADGF Dashboard Frontend Script
//  Section 1: Official Thesis Results
//  Section 2: Custom Exploratory Runs
// =========================================================

// =================== SECTION 1 ===================

async function fetchResults() {
    try {
        const response = await fetch('/api/results');
        const data = await response.json();
        updateStatusPanel(data);
        renderTable(data);
        renderChart(data);
    } catch (e) {
        console.error("Error fetching results", e);
        updateConsole("status-console", "Initialization Error: Unable to fetch local results.");
    }
}

function truncateHash(hash) {
    if (!hash || hash === "" || hash.includes("N/A")) return "N/A";
    return `<span class="hash-truncate">${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}</span>`;
}

function renderTable(data) {
    const tableBody = document.querySelector("#results-table tbody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    const { baseline, sandwich } = data;
    const prot = data.protected;

    const metrics = [
        { label: "Scenario", key: "scenario_name" },
        { label: "Expected/Reference Output", key: "baseline_expected_output", fb: "expected_output", fb2: "reference_output", formatter: (d) => `${parseFloat(d.baseline_expected_output || d.expected_output || d.reference_output || 0).toFixed(6)} USDC` },
        { label: "Actual/Simulated Output", key: "attacked_actual_output", fb: "actual_output", fb2: "simulated_output", formatter: (d) => `${parseFloat(d.attacked_actual_output || d.actual_output || d.simulated_output || 0).toFixed(6)} USDC` },
        { label: "Victim Loss", key: "victim_output_loss", default: "0.00", formatter: (d) => d.victim_output_loss ? `${parseFloat(d.victim_output_loss).toFixed(6)} USDC` : "0.00 USDC" },
        { label: "Slippage Deviation", key: "slippage_deviation", default: "N/A", formatter: (d) => d.slippage_deviation ? `${parseFloat(d.slippage_deviation).toFixed(4)}%` : "N/A" },
        { label: "Gas Used", key: "gas_used", fb: "victim_gas_used", formatter: (d) => d.gas_used || d.victim_gas_used || "N/A" },
        { label: "Risk Score", key: "normalized_risk_score", default: "N/A", formatter: (d) => d.normalized_risk_score ? parseFloat(d.normalized_risk_score).toFixed(4) : "N/A" },
        { label: "PADGF Decision", key: "padgf_decision", default: "N/A" },
        { label: "Execution Status", key: "execution_status" }
    ];

    const generateCell = (obj, m) => {
        if (!obj) return `<td><em>Not Evaluated</em></td>`;
        let val;
        if (m.formatter) val = m.formatter(obj);
        else val = obj[m.key] || obj[m.fb] || obj[m.fb2] || m.default || "N/A";

        if (val === "success" || val === "Execute" || val === true)
            return `<td><span class="status-success">${val}</span></td>`;
        if (val === "Block" || val === "error" || String(val) === 'false' || (m.key === "victim_output_loss" && parseFloat(val) > 0))
            return `<td><span class="status-error">${val}</span></td>`;
        if (val === "Delay")
            return `<td><span style="color:#d35400; font-weight:bold;">${val}</span></td>`;
        return `<td>${val}</td>`;
    };

    metrics.forEach(m => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="metric-name">${m.label}</td>
            ${generateCell(baseline, m)}
            ${generateCell(sandwich, m)}
            ${generateCell(prot, m)}
        `;
        tableBody.appendChild(tr);
    });
}

function updateConsole(id, text) {
    const cons = document.getElementById(id);
    if (cons) {
        cons.textContent = text;
        cons.scrollTop = cons.scrollHeight;
    }
}

function updateStatusPanel(data) {
    const setStatus = (id, obj) => {
        const el = document.getElementById(id);
        if (el) {
            if (obj && obj.execution_status === 'success') {
                el.textContent = "Completed";
                el.className = "status-completed";
            } else {
                el.textContent = "Pending";
                el.className = "status-pending";
            }
        }
    };
    setStatus("status-phase1", data.baseline);
    setStatus("status-phase2", data.sandwich);
    setStatus("status-phase3", data.protected);
}

function renderChart(data) {
    const chartContainer = document.getElementById("bar-chart");
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    const v1 = data.baseline ? parseFloat(data.baseline.actual_output || data.baseline.expected_output) : 0;
    const v2 = data.sandwich ? parseFloat(data.sandwich.attacked_actual_output) : 0;
    const v3 = data.protected ? parseFloat(data.protected.actual_output || data.protected.simulated_output) : 0;

    const values = [v1, v2, v3];
    const validValues = values.filter(v => v > 0);
    const minVal = validValues.length ? Math.min(...validValues) - 5 : 0;
    const maxVal = validValues.length ? Math.max(...validValues) + 5 : 100;

    const createBar = (label, value) => {
        if (!value) return '<div class="bar-wrapper"></div>';
        const heightPct = Math.max(5, ((value - minVal) / (maxVal - minVal)) * 100);
        return `
            <div class="bar-wrapper">
                <div class="bar-value">${value.toFixed(2)}</div>
                <div class="bar" style="height: ${heightPct}%;"></div>
                <div class="bar-label">${label}</div>
            </div>
        `;
    };

    chartContainer.innerHTML = `
        ${createBar("Baseline", v1)}
        ${createBar("Sandwich Attack", v2)}
        ${createBar("PADGF Protected", v3)}
    `;
}

async function runPhase(phaseRoute) {
    const btnId = `btn-${phaseRoute}`;
    const btn = document.getElementById(btnId);

    document.querySelectorAll("#official-section button").forEach(b => b.disabled = true);
    let originalText = btn.textContent;
    btn.textContent = "Executing...";
    updateConsole("status-console", `Initiating execution for ${phaseRoute}...`);

    try {
        const response = await fetch(`/api/run/${phaseRoute}`, { method: 'POST' });
        const data = await response.json();
        if (data.stdout) updateConsole("status-console", `[SYSTEM OUTPUT]\n\n${data.stdout}`);
        else if (data.error) updateConsole("status-console", `[SYSTEM ERROR]\n\n${data.stderr}\n\n${data.error}`);
        await fetchResults();
    } catch (e) {
        updateConsole("status-console", "Execution Failure: " + e.message);
    } finally {
        document.querySelectorAll("#official-section button").forEach(b => b.disabled = false);
        btn.textContent = originalText;
    }
}

// =================== SECTION 2: CUSTOM RUNS ===================

async function runCustom() {
    let amount = document.getElementById("custom-amount").value;
    if (amount === "other") {
        amount = document.getElementById("custom-amount-custom").value;
        if (!amount || isNaN(amount) || amount <= 0) {
            alert("Please enter a valid numeric amount greater than 0.");
            return;
        }
    }
    const slippage = document.getElementById("custom-slippage").value;
    const scenario = document.getElementById("custom-scenario").value;

    const btn = document.getElementById("btn-custom-run");
    btn.disabled = true;
    btn.textContent = "Running...";
    updateConsole("custom-console", `[Exploratory Test] Running ${scenario} | ${amount} WETH | ${slippage}% slippage...`);

    try {
        const response = await fetch('/api/run/custom', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, slippage, scenario })
        });
        const data = await response.json();

        if (data.stdout) {
            updateConsole("custom-console", `[SYSTEM OUTPUT]\n\n${data.stdout}`);
        }
        if (data.error) {
            updateConsole("custom-console", `[ERROR]\n\n${data.error}\n${data.stderr || ''}`);
        }

        if (data.result) {
            renderCustomResult(data.result);
        }
    } catch (e) {
        updateConsole("custom-console", "Execution Failure: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Run Exploratory Test";
    }
}

function renderCustomResult(result) {
    const panel = document.getElementById("custom-result-panel");
    const tbody = document.querySelector("#custom-result-table tbody");
    tbody.innerHTML = "";
    panel.style.display = "block";

    // Build metric rows dynamically based on what fields exist
    const rows = [
        ["Run Type", result.run_type || result.demo_type || "Custom Run"],
        ["Scenario", result.scenario],
        ["Fork Block", result.fork_block || "19400000 (Thesis Default)"],
        ["DEX", result.dex || "Uniswap V2"],
        ["Token Pair", result.input_token ? `${result.input_token} → ${result.output_token}` : "WETH → USDC"],
        ["Input Amount", typeof result.input_amount === 'string' ? result.input_amount : `${result.input_amount || result.victim_input_amount || 0} WETH`],
        ["Slippage Tolerance", result.slippage_tolerance],
    ];

    // Scenario-specific fields
    if (result.expected_output) rows.push(["Expected Output", `${result.expected_output} USDC`]);
    if (result.actual_output) rows.push(["Actual Output", `${result.actual_output} USDC`]);
    if (result.reference_output) rows.push(["Reference Output", `${result.reference_output} USDC`]);
    if (result.simulated_output) rows.push(["Simulated Output", `${result.simulated_output} USDC`]);
    if (result.baseline_expected_output) rows.push(["Baseline Expected Output", `${result.baseline_expected_output} USDC`]);
    if (result.attacked_actual_output) rows.push(["Attacked Actual Output", `${result.attacked_actual_output} USDC`]);
    if (result.victim_output_loss) rows.push(["Victim Loss", `${result.victim_output_loss} USDC`]);
    if (result.financial_loss_percentage) rows.push(["Financial Loss", result.financial_loss_percentage]);
    if (result.slippage_deviation) rows.push(["Slippage Deviation", `${parseFloat(result.slippage_deviation).toFixed(4)}%`]);
    if (result.gas_used) rows.push(["Gas Used", result.gas_used]);
    if (result.victim_gas_used) rows.push(["Victim Gas Used", result.victim_gas_used]);
    if (result.attacker_gas_used) rows.push(["Attacker Gas Used", result.attacker_gas_used]);
    
    if (result.attacker_gross_profit_usdc !== undefined) rows.push(["Attacker Gross Profit", `${parseFloat(result.attacker_gross_profit_usdc).toFixed(4)} USDC`]);
    if (result.attacker_gas_cost_usdc !== undefined) rows.push(["Attacker Gas Cost", `${parseFloat(result.attacker_gas_cost_usdc).toFixed(4)} USDC`]);
    if (result.attacker_net_profit_usdc !== undefined) rows.push(["Attacker Net Profit", `${parseFloat(result.attacker_net_profit_usdc).toFixed(4)} USDC`]);
    if (result.profitability_ratio !== undefined) {
        let pRatio = String(result.profitability_ratio);
        rows.push(["Profitability Ratio", pRatio.includes('%') ? pRatio : `${parseFloat(pRatio).toFixed(4)}%`]);
    }

    // Demo mode fields
    if (result.tau1 !== undefined) rows.push(["Threshold tau1", result.tau1]);
    if (result.tau2 !== undefined) rows.push(["Threshold tau2", result.tau2]);
    if (result.normalized_risk_score !== undefined) rows.push(["Risk Score (Exposure Estimate)", parseFloat(result.normalized_risk_score).toFixed(4)]);

    if (result.decision) rows.push(["PADGF Decision", result.decision]);
    else if (result.padgf_decision) rows.push(["PADGF Risk-Aware Decision", result.padgf_decision]);
    if (result.explanation) rows.push(["Explanation", result.explanation]);

    if (result.execution_allowed !== undefined) rows.push(["Execution Allowed", String(result.execution_allowed)]);
    if (result.transaction_hash) rows.push(["Transaction Hash", result.transaction_hash || "N/A"]);

    if (result.execution_status) rows.push(["Execution Status", result.execution_status]);
    if (result.timestamp) rows.push(["Timestamp", result.timestamp]);

    rows.forEach(([label, value]) => {
        const tr = document.createElement("tr");
        if (value === "Delay") {
            tr.innerHTML = `<td class="metric-name">${label}</td><td><span style="color:#d35400; font-weight:bold;">${value}</span></td>`;
        } else {
            let cls = "";
            if (value === "success" || value === "Execute" || value === "true") cls = "status-success";
            else if (value === "Block" || value === "false" || (String(label).includes("Victim Loss") && parseFloat(value) > 0)) cls = "status-error";

            tr.innerHTML = `<td class="metric-name">${label}</td><td><span class="${cls}">${value}</span></td>`;
        }
        tbody.appendChild(tr);
    });

    renderCustomChart(result);
}

function renderCustomChart(result, targetId = "custom-bar-chart") {
    const chartContainer = document.getElementById(targetId);
    if (!chartContainer) return;
    chartContainer.innerHTML = '';

    let labels = [];
    let values = [];

    // Depending on the scenario, plot relevant outputs
    if (result.scenario && result.scenario.includes("Baseline")) {
        labels = ["Expected Output", "Actual Output"];
        values = [
            parseFloat(result.expected_output || result.baseline_expected_output || 0),
            parseFloat(result.actual_output || 0)
        ];
    } else if (result.scenario && result.scenario.includes("Sandwich")) {
        labels = ["Baseline Expected", "Attacked Output"];
        values = [
            parseFloat(result.baseline_expected_output || 0),
            parseFloat(result.attacked_actual_output || 0)
        ];
    } else if (result.scenario && result.scenario.includes("Protected")) {
        labels = ["Reference Output", "Simulated Output", "Actual Final Output"];
        values = [
            parseFloat(result.reference_output || 0),
            parseFloat(result.simulated_output || 0),
            parseFloat(result.actual_output || result.simulated_output || 0)
        ];
    } else if (result.run_type && result.run_type.includes("User-Driven")) {
        labels = ["Reference", "Simulated"];
        values = [
            parseFloat(result.reference_output || 0),
            parseFloat(result.simulated_output || 0)
        ];
        if (result.actual_output) {
            labels.push("Actual Final");
            values.push(parseFloat(result.actual_output));
        }
    } else {
        // Fallback generic plotting
        if (result.expected_output) { labels.push("Expected"); values.push(parseFloat(result.expected_output)); }
        if (result.actual_output) { labels.push("Actual"); values.push(parseFloat(result.actual_output)); }
    }

    const validValues = values.filter(v => !isNaN(v) && v > 0);
    if (validValues.length === 0) return;

    const minVal = Math.min(...validValues) - (Math.min(...validValues) * 0.05);
    const maxVal = Math.max(...validValues) + (Math.max(...validValues) * 0.05);

    const createBar = (label, value) => {
        if (!value) return '<div class="bar-wrapper"></div>';
        const heightPct = Math.max(5, ((value - minVal) / (maxVal - minVal)) * 100);
        return `
            <div class="bar-wrapper">
                <div class="bar-value">${value.toFixed(2)}</div>
                <div class="bar" style="height: ${heightPct}%;"></div>
                <div class="bar-label" style="font-size: 11px;">${label}</div>
            </div>
        `;
    };

    let innerHTML = '';
    for (let i = 0; i < values.length; i++) {
        innerHTML += createBar(labels[i], values[i]);
    }
    
    chartContainer.innerHTML = innerHTML;
}

// =================== SECTION 3: USER-DRIVEN EXPLORATORY MODE ===================

let currentUdContext = null;
let cachedGasPrices = null;

async function fetchGasPrices() {
    try {
        const response = await fetch('/api/gas-prices');
        const data = await response.json();
        cachedGasPrices = data;
        updateGasDropdown(data);
    } catch (e) {
        console.warn('Gas price fetch failed, using defaults');
        // Populate with fallback values
        const fallback = {
            standard: { gwei: '1.00', totalEth: '0.000150' },
            fast: { gwei: '1.50', totalEth: '0.000225' },
            instant: { gwei: '2.50', totalEth: '0.000375' },
            swapGasUnits: 150000
        };
        cachedGasPrices = fallback;
        updateGasDropdown(fallback);
    }
}

function updateGasDropdown(data) {
    const stdOpt = document.getElementById('gas-opt-standard');
    const fastOpt = document.getElementById('gas-opt-fast');
    const instOpt = document.getElementById('gas-opt-instant');
    if (stdOpt) stdOpt.textContent = `${data.standard.gwei} Gwei — ~${data.standard.totalEth} ETH`;
    if (fastOpt) fastOpt.textContent = `${data.fast.gwei} Gwei — ~${data.fast.totalEth} ETH (1.5×)`;
    if (instOpt) instOpt.textContent = `${data.instant.gwei} Gwei — ~${data.instant.totalEth} ETH (2.5×)`;
    
    // Update the cost text below the dropdown
    updateGasCostText();
}

function updateGasCostText() {
    const gasSpeedEl = document.getElementById('ud-gas-speed');
    const gasCostText = document.getElementById('ud-gas-cost-text');
    if (!gasSpeedEl || !gasCostText || !cachedGasPrices) return;
    
    const selected = gasSpeedEl.value;
    const tier = cachedGasPrices[selected];
    if (tier) {
        gasCostText.textContent = `Selected: ${tier.gwei} Gwei | Estimated Swap Cost: ~${tier.totalEth} ETH`;
    }
}

// Listen for dropdown changes to update the cost text
document.addEventListener('DOMContentLoaded', function() {
    const gasSpeedEl = document.getElementById('ud-gas-speed');
    if (gasSpeedEl) {
        gasSpeedEl.addEventListener('change', updateGasCostText);
    }

    // Toggle custom input field visibility
    const amountEl = document.getElementById("ud-amount");
    const amountCustomEl = document.getElementById("ud-amount-custom");
    if (amountEl && amountCustomEl) {
        amountEl.addEventListener("change", function() {
            if (this.value === "other") {
                amountCustomEl.style.display = "block";
                amountCustomEl.focus();
            } else {
                amountCustomEl.style.display = "none";
            }
        });
    }

    const customAmountEl = document.getElementById("custom-amount");
    const customAmountCustomEl = document.getElementById("custom-amount-custom");
    if (customAmountEl && customAmountCustomEl) {
        customAmountEl.addEventListener("change", function() {
            if (this.value === "other") {
                customAmountCustomEl.style.display = "block";
                customAmountCustomEl.focus();
            } else {
                customAmountCustomEl.style.display = "none";
            }
        });
    }
});

async function runUserDrivenEvaluate() {
    let amount = document.getElementById("ud-amount").value;
    if (amount === "other") {
        amount = document.getElementById("ud-amount-custom").value;
        if (!amount || isNaN(amount) || amount <= 0) {
            alert("Please enter a valid numeric amount greater than 0.");
            return;
        }
    }
    const slippage = document.getElementById("ud-slippage").value;
    const btn = document.getElementById("btn-ud-run");
    
    btn.disabled = true;
    btn.textContent = "Evaluating...";
    document.getElementById("ud-warning-panel").style.display = "none";
    document.getElementById("ud-result-panel").style.display = "none";
    
    updateConsole("ud-console", `[Exploratory Mode] Evaluating | Input: ${amount} WETH | Slippage: ${slippage}%...`);

    try {
        const response = await fetch('/api/run/user-driven-evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, slippage })
        });
        const data = await response.json();
        
        if (data.stdout) updateConsole("ud-console", `[EVALUATION OUTPUT]\n\n${data.stdout}`);
        if (data.error) updateConsole("ud-console", `[ERROR]\n\n${data.error}\n${data.stderr || ''}`);

        if (data.result) {
            currentUdContext = { amount, slippage, risk_level: data.result.risk_level };
            
            const riskLevel = data.result.risk_level;
            const rec = data.result.padgf_recommendation;
            
            const wp = document.getElementById("ud-warning-panel");
            const wText = document.getElementById("ud-warning-text");
            const aText = document.getElementById("ud-assessment-text");
            const rText = document.getElementById("ud-recommendation-text");
            
            const score = data.result.normalized_risk_score;
            const rScoreText = document.getElementById("ud-risk-score-text");
            rScoreText.textContent = `Calculated Risk Score: ${parseFloat(score).toFixed(4)}`;
            
            const gasCostEth = data.result.estimated_gas_cost_eth;
            const gasGwei = parseFloat(data.result.estimated_gas_price_gwei).toFixed(2);
            
            // Update dropdown with live values from the evaluation
            const liveGas = {
                standard: { gwei: gasGwei, totalEth: parseFloat(gasCostEth).toFixed(6) },
                fast: { gwei: (parseFloat(gasGwei) * 1.5).toFixed(2), totalEth: (parseFloat(gasCostEth) * 1.5).toFixed(6) },
                instant: { gwei: (parseFloat(gasGwei) * 2.5).toFixed(2), totalEth: (parseFloat(gasCostEth) * 2.5).toFixed(6) },
                swapGasUnits: 150000
            };
            cachedGasPrices = liveGas;
            updateGasDropdown(liveGas);
            
            let badgeColor = "#2ecc71";
            if (riskLevel === "Moderate") badgeColor = "#f39c12";
            if (riskLevel === "High") badgeColor = "#e74c3c";
            
            aText.innerHTML = `PADGF Assessment: <span style="color:${badgeColor}">${riskLevel} Risk</span>`;
            rText.textContent = `Recommendation: ${rec}`;
            rText.style.color = badgeColor;
            
            if (riskLevel === "Low") {
                updateConsole("ud-console", "[Exploratory Mode] Low Risk. Auto-executing...");
                await udUserDecision('auto', 'auto_executed');
            } else if (riskLevel === "Moderate") {
                const tau1 = data.result.tau1 || 0.3;
                const tau2 = data.result.tau2 || 0.7;
                const minDelay = 15;
                const maxDelay = 45;
                
                // Calculate dynamic delay: scale risk score directly to a wait time (between 15 and 45 seconds).
                // Formula: MIN_DELAY + ((score - tau1) / (tau2 - tau1)) * (MAX_DELAY - MIN_DELAY)
                let delaySeconds = 30; // fallback
                if (tau2 > tau1) {
                    const safeScore = Math.max(tau1, Math.min(score, tau2));
                    const delayFraction = (safeScore - tau1) / (tau2 - tau1);
                    delaySeconds = Math.round(minDelay + delayFraction * (maxDelay - minDelay));
                }

                wText.textContent = `Warning: This transaction has been classified as moderate risk. PADGF recommends delaying execution by ${delaySeconds} seconds to allow mempool conditions to stabilize before proceeding.`;
                wp.style.borderColor = badgeColor;
                
                // Inject Moderate-specific buttons: Delay (with timer) + Continue Now
                const controlsDiv = document.getElementById("ud-controls");
                controlsDiv.innerHTML = `
                    <button id="btn-ud-delay" onclick="udStartDelay(${delaySeconds})" style="background: linear-gradient(135deg, #f39c12, #d68910);">Delay Transaction (${delaySeconds}s)</button>
                    <button id="btn-ud-continue-now" class="secondary" onclick="udUserDecision('continue')">Continue Now</button>
                `;
                document.getElementById("ud-delay-timer").style.display = "none";
                
                wp.style.display = "block";
                updateConsole("ud-console", `[Exploratory Mode] Moderate Risk (Score: ${parseFloat(score).toFixed(4)}). PADGF dynamically recommends ${delaySeconds}s delay. Waiting for user decision...`);
            } else if (riskLevel === "High") {
                wText.textContent = "Warning: PADGF has identified high-risk transaction conditions that may expose the swap to sandwich attack behavior. Continuing may result in reduced output or financial loss. Do you want to continue?";
                wp.style.borderColor = badgeColor;
                
                // Inject High-risk buttons: Cancel + Continue
                const controlsDiv = document.getElementById("ud-controls");
                controlsDiv.innerHTML = `
                    <button id="btn-ud-cancel" onclick="udUserDecision('cancel')" style="background: linear-gradient(135deg, #ef4444, #b91c1c);">Cancel Transaction</button>
                    <button id="btn-ud-continue" class="secondary" onclick="udUserDecision('continue')">Continue Transaction</button>
                `;
                document.getElementById("ud-delay-timer").style.display = "none";
                
                wp.style.display = "block";
                updateConsole("ud-console", "[Exploratory Mode] High Risk. Waiting for user decision...");
            }
        }
    } catch (e) {
        updateConsole("ud-console", "Evaluation Failure: " + e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = "Run User-Driven PADGF Evaluation";
    }
}

let delayTimerInterval = null;

function udStartDelay(seconds) {
    // Disable both buttons during countdown
    const delayBtn = document.getElementById("btn-ud-delay");
    const continueBtn = document.getElementById("btn-ud-continue-now");
    if (delayBtn) delayBtn.disabled = true;
    if (continueBtn) continueBtn.disabled = true;
    
    const timerEl = document.getElementById("ud-delay-timer");
    timerEl.style.display = "block";
    
    let remaining = seconds;
    timerEl.textContent = `⏳ Delaying execution: ${remaining}s remaining...`;
    updateConsole("ud-console", `[Exploratory Mode] User chose to delay. Waiting ${seconds}s for mempool conditions to stabilize...`);
    
    delayTimerInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            timerEl.textContent = `⏳ Delaying execution: ${remaining}s remaining...`;
        } else {
            clearInterval(delayTimerInterval);
            delayTimerInterval = null;
            timerEl.textContent = `✅ Delay complete. Executing transaction...`;
            timerEl.style.color = "#2ecc71";
            updateConsole("ud-console", `[Exploratory Mode] ${seconds}s delay complete. Auto-executing transaction...`);
            
            // Auto-execute after delay
            udUserDecision('delay', 'delayed_then_executed');
        }
    }, 1000);
}

async function udUserDecision(choice, autoActionOverride = null) {
    let userAction = autoActionOverride;
    let executionType = "none";
    
    // Clear any running delay timer if user makes a different choice
    if (delayTimerInterval && choice !== 'delay') {
        clearInterval(delayTimerInterval);
        delayTimerInterval = null;
    }
    
    if (choice === 'cancel') {
        userAction = "cancelled";
        executionType = "none";
        document.getElementById("ud-warning-panel").style.display = "none";
        document.getElementById("ud-delay-timer").style.display = "none";
        updateConsole("ud-console", "[Exploratory Mode] User cancelled the transaction.");
    } else if (choice === 'delay') {
        // Delay completed - execute normally
        userAction = autoActionOverride || "delayed_then_executed";
        executionType = "normal";
        document.getElementById("ud-warning-panel").style.display = "none";
    } else if (choice === 'continue') {
        if (currentUdContext.risk_level === "High") {
            userAction = "accepted_high_warning";
            executionType = "sandwich";
        } else {
            userAction = "accepted_delay_warning";
            executionType = "normal";
        }
        document.getElementById("ud-warning-panel").style.display = "none";
        document.getElementById("ud-delay-timer").style.display = "none";
        updateConsole("ud-console", `[Exploratory Mode] User continued immediately despite ${currentUdContext.risk_level} risk warning. Executing...`);
    } else if (choice === 'auto') {
        userAction = "auto_executed";
        executionType = "normal";
    }
    
    // Disable main button while running
    const btn = document.getElementById("btn-ud-run");
    btn.disabled = true;
    
    // Read gas speed override
    const gasSpeedEl = document.getElementById("ud-gas-speed");
    let gasSpeed = gasSpeedEl ? gasSpeedEl.value : "standard";
    if (choice === 'auto') gasSpeed = "standard"; // Safety fallback for automated executions
    
    try {
        const response = await fetch('/api/run/user-driven-execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: currentUdContext.amount,
                slippage: currentUdContext.slippage,
                userAction,
                executionType,
                gasSpeed
            })
        });
        const data = await response.json();
        
        if (data.stdout && choice !== 'cancel') updateConsole("ud-console", `[EXECUTION OUTPUT]\n\n${data.stdout}`);
        
        if (data.result) {
            renderUdResult(data.result);
        }
    } catch (e) {
        updateConsole("ud-console", "Execution Failure: " + e.message);
    } finally {
        btn.disabled = false;
    }
}

function renderUdResult(result) {
    const panel = document.getElementById("ud-result-panel");
    const tbody = document.querySelector("#ud-result-table tbody");
    tbody.innerHTML = "";
    panel.style.display = "block";
    
    const rows = [
        ["Run Type", result.run_type],
        ["Output Artifact", result.output_artifact],
        ["Input Amount", `${result.input_amount} WETH`],
        ["Slippage Tolerance", result.slippage_tolerance],
        ["Reference Output", `${parseFloat(result.reference_output).toFixed(6)} USDC`],
        ["Simulated Output", `${parseFloat(result.simulated_output).toFixed(6)} USDC`]
    ];
    
    if (result.actual_output) rows.push(["Actual Output", `${parseFloat(result.actual_output).toFixed(6)} USDC`]);
    if (result.baseline_output) rows.push(["Baseline Output", `${parseFloat(result.baseline_output).toFixed(6)} USDC`]);
    if (result.victim_output_loss) rows.push(["Victim Output Loss", `${result.victim_output_loss} USDC`]);
    if (result.financial_loss_percentage) rows.push(["Financial Loss Percentage", result.financial_loss_percentage]);
    
    // Calculate the actual applied gas cost in Gwei
    const appliedSpeed = result.gas_speed_applied ? result.gas_speed_applied.toLowerCase() : 'standard';
    let appliedGasCostGwei = result.estimated_gas_price_gwei ? parseFloat(result.estimated_gas_price_gwei).toFixed(2) : 'N/A';
    let appliedGasCostEth = result.estimated_gas_cost_eth ? parseFloat(result.estimated_gas_cost_eth).toFixed(6) : 'N/A';
    if (appliedSpeed === 'fast' && appliedGasCostGwei !== 'N/A') {
        appliedGasCostGwei = (parseFloat(appliedGasCostGwei) * 1.5).toFixed(2);
        appliedGasCostEth = (parseFloat(appliedGasCostEth) * 1.5).toFixed(6);
    } else if (appliedSpeed === 'instant' && appliedGasCostGwei !== 'N/A') {
        appliedGasCostGwei = (parseFloat(appliedGasCostGwei) * 2.5).toFixed(2);
        appliedGasCostEth = (parseFloat(appliedGasCostEth) * 2.5).toFixed(6);
    }

    rows.push(
        ["Slippage Deviation", `${result.slippage_deviation}%`],
        ["Price Impact", `${result.price_impact}%`],
        ["Applied Gas Cost", `${appliedGasCostGwei} Gwei (~${appliedGasCostEth} ETH)`],
        ["Attacker Gross Profit", result.attacker_gross_profit_usdc !== undefined ? `${parseFloat(result.attacker_gross_profit_usdc).toFixed(4)} USDC` : "N/A"],
        ["Attacker Gas Cost", result.attacker_gas_cost_usdc !== undefined ? `${parseFloat(result.attacker_gas_cost_usdc).toFixed(4)} USDC` : "N/A"],
        ["Attacker Net Profit", result.attacker_net_profit_usdc !== undefined ? `${parseFloat(result.attacker_net_profit_usdc).toFixed(4)} USDC` : "N/A"],
        ["Profitability Ratio", result.profitability_ratio !== undefined ? (String(result.profitability_ratio).includes('%') ? result.profitability_ratio : `${parseFloat(result.profitability_ratio).toFixed(4)}%`) : "N/A"],
        ["Normalized Risk Score", result.normalized_risk_score],
        ["Thresholds", `tau1 = ${result.tau1}, tau2 = ${result.tau2}`],
        ["PADGF Risk Level", result.risk_level],
        ["PADGF Recommendation", result.padgf_recommendation],
        ["User Action", result.user_action],
        ["Execution Allowed", result.execution_allowed.toString()],
        ["Final Status", result.execution_status]
    );

    rows.forEach(([label, value]) => {
        const tr = document.createElement("tr");
        let styledValue = value;
        
        if (label === "PADGF Risk Level" || label === "PADGF Recommendation" || label === "Final Status" || label === "User Action") {
            let cls = "";
            if (value.includes("Low") || value.includes("Execute") || value === "executed_low_risk" || value === "auto_executed") cls = "status-success";
            else if (value.includes("Moderate") || value.includes("Delay") || value === "accepted_delay_warning" || value === "executed_after_delay_warning" || value === "delayed_then_executed") cls = "status-pending"; // generic yellow/orange
            else if (value.includes("High") || value.includes("Block") || value === "accepted_high_warning" || value === "executed_after_high_risk_warning" || value === "continued_despite_warning" || value === "executed_after_warning") cls = "status-error";
            else if (value.includes("cancel")) cls = "status-pending"; // gray or default
            
            styledValue = `<span class="${cls}" ${cls === "status-pending" && (value.includes("Moderate") || value.includes("Delay") || value === "accepted_delay_warning" || value === "executed_after_delay_warning" || value === "delayed_then_executed" || value === "continued_despite_warning" || value === "executed_after_warning") ? 'style="color:#d35400; font-weight:bold;"' : ''}>${value}</span>`;
            if (value.includes("cancel")) styledValue = `<span style="color:#7f8c8d; font-weight:bold;">${value}</span>`;
        }
        
        tr.innerHTML = `<td class="metric-name">${label}</td><td>${styledValue}</td>`;
        tbody.appendChild(tr);
    });
    
    renderCustomChart(result, "ud-bar-chart");
}


// =================== SECTION 3: ABOUT MODAL & PERSISTENCE ===================
function openAboutModal() {
    const modal = document.getElementById("about-modal");
    if (modal) {
        loadTeamData();
        modal.style.display = "flex";
    }
}

function closeAboutModal() {
    const modal = document.getElementById("about-modal");
    if (modal) modal.style.display = "none";
}

// Close when clicking outside the modal content
window.addEventListener("click", function(event) {
    const modal = document.getElementById("about-modal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
});

// Load saved bio and images
function loadTeamData() {
    for (let i = 1; i <= 7; i++) {
        const savedBio = localStorage.getItem('member_bio_' + i);
        if (savedBio !== null) {
            const bioEl = document.getElementById('member-bio-' + i);
            if(bioEl) bioEl.innerText = savedBio;
        }

        const savedImg = localStorage.getItem('member_img_' + i);
        if (savedImg !== null) {
            const imgDiv = document.getElementById('member-img-' + i);
            if(imgDiv) {
                imgDiv.style.backgroundImage = `url(${savedImg})`;
                imgDiv.style.backgroundSize = 'cover';
                imgDiv.style.backgroundPosition = 'center';
                imgDiv.innerText = '';
            }
        }
    }
}

// Save bio text on input
function saveBio(id) {
    const bioEl = document.getElementById('member-bio-' + id);
    if(bioEl) {
        localStorage.setItem('member_bio_' + id, bioEl.innerText);
    }
}

// Upload photo and save to localStorage
function uploadPhoto(event, id) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const result = e.target.result;
            const imgDiv = document.getElementById('member-img-' + id);
            if(imgDiv) {
                imgDiv.style.backgroundImage = `url(${result})`;
                imgDiv.style.backgroundSize = 'cover';
                imgDiv.style.backgroundPosition = 'center';
                imgDiv.innerText = '';
            }
            try {
                localStorage.setItem('member_img_' + id, result);
            } catch (err) {
                console.warn("Storage full. Cannot persist image.");
            }
        };
        reader.readAsDataURL(file);
    }
}
