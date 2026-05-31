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
    const tbody = document.querySelector("#results-table tbody");
    tbody.innerHTML = "";

    const { baseline, sandwich } = data;
    const prot = data.protected;

    const metrics = [
        { label: "Scenario", key: "scenario_name" },
        { label: "Expected/Reference Output", key: "baseline_expected_output", fb: "expected_output", fb2: "reference_output", formatter: (d) => `${parseFloat(d.baseline_expected_output || d.expected_output || d.reference_output || 0).toFixed(6)} USDC` },
        { label: "Actual/Simulated Output", key: "attacked_actual_output", fb: "actual_output", fb2: "simulated_output", formatter: (d) => `${parseFloat(d.attacked_actual_output || d.actual_output || d.simulated_output || 0).toFixed(6)} USDC` },
        { label: "Victim Loss", key: "victim_output_loss", default: "0.00", formatter: (d) => d.victim_output_loss ? `${parseFloat(d.victim_output_loss).toFixed(6)} USDC` : "0.00 USDC" },
        { label: "Slippage Deviation", key: "slippage_deviation", default: "N/A", formatter: (d) => d.slippage_deviation ? `${parseFloat(d.slippage_deviation).toFixed(4)}%` : "N/A" },
        { label: "Gas Used", key: "gas_used", fb: "victim_gas_used", fb2: "gas_sensitivity", formatter: (d) => d.gas_used || d.victim_gas_used || (d.gas_sensitivity ? d.gas_sensitivity + " Gwei" : "N/A") },
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
        tbody.appendChild(tr);
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
    const amount = document.getElementById("custom-amount").value;
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
        let cls = "";
        if (value === "success" || value === "Execute" || value === "true") cls = "status-success";
        else if (value === "Block" || value === "false") cls = "status-error";
        else if (value === "Delay") cls = 'style="color:#d35400; font-weight:bold;"';

        tr.innerHTML = `<td class="metric-name">${label}</td><td><span class="${cls}">${value}</span></td>`;
        tbody.appendChild(tr);
    });

    renderCustomChart(result);
}

function renderCustomChart(result) {
    const chartContainer = document.getElementById("custom-bar-chart");
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

// =================== INIT ===================
window.onload = fetchResults;

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
