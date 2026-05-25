const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const displayMenu = () => {
    console.log("=========================================");
    console.log("   PADGF Prototype - Practical Evaluation");
    console.log("=========================================");
    console.log("1. Run Phase 1: Baseline Swap");
    console.log("2. Run Phase 2: Sandwich Attack Simulation");
    console.log("3. Run Phase 3: PADGF Protected Swap");
    console.log("4. View Latest Results");
    console.log("5. Exit");
    console.log("=========================================");
    rl.question("Select an option (1-5): ", handleOption);
};

const handleOption = (answer) => {
    const opt = answer.trim();
    if (opt === '5') {
        process.exit(0);
    }

    if (opt === '4') {
        console.log("\n--- LATEST PROTECTED SWAP RESULTS ---");
        const resPath = path.join(__dirname, '..', 'results', 'protected_swap_result.json');
        if (fs.existsSync(resPath)) {
            const data = JSON.parse(fs.readFileSync(resPath));
            printSummaryTable(data);
        } else {
            console.log("No results found. Run Phase 3 first.");
        }
        console.log("\n");
        return displayMenu();
    }

    let scriptPath = '';
    
    if (opt === '1') {
        scriptPath = "scripts/baseline-swap.js";
        console.log("Executing baseline swap...");
    } else if (opt === '2') {
        scriptPath = "scripts/sandwich-attack.js";
        console.log("Executing sandwich attack simulation...");
    } else if (opt === '3') {
        scriptPath = "scripts/protected-swap.js";
        console.log("Executing PADGF protected swap...");
    } else {
        console.log("Invalid option.\n");
        return displayMenu();
    }
        
    const command = `npx hardhat run ${scriptPath} --network localhost`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) console.error(`Error: ${error.message}`);
        if (stderr && stderr.includes("Error")) console.error(`Stderr: ${stderr}`);
        
        console.log(stdout);

        if (opt === '3') {
            const resPath = path.join(__dirname, '..', 'results', 'protected_swap_result.json');
            if (fs.existsSync(resPath)) {
                const data = JSON.parse(fs.readFileSync(resPath));
                printSummaryTable(data);
            }
        }

        console.log("");
        displayMenu();
    });
};

function printSummaryTable(data) {
    console.log("\n*** PADGF EXECUTION SUMMARY TABLE ***");
    console.log("---------------------------------------------------------");
    console.log(`Reference Output   : ${data.reference_output} USDC`);
    console.log(`Simulated Output   : ${data.simulated_output} USDC`);
    console.log(`Slippage Deviation : ${parseFloat(data.slippage_deviation).toFixed(4)}%`);
    console.log(`Price Impact       : ${parseFloat(data.price_impact).toFixed(4)}%`);
    console.log(`Gas Sensitivity    : ${parseFloat(data.gas_sensitivity).toFixed(2)} Gwei`);
    console.log(`Risk Score         : ${parseFloat(data.normalized_risk_score).toFixed(4)}`);
    console.log(`PADGF Decision     : ${data.padgf_decision}`);
    console.log(`Execution Allowed  : ${data.execution_allowed}`);
    if (data.execution_allowed) {
        console.log(`Transaction Hash   : ${data.transaction_hash}`);
    }
    console.log("---------------------------------------------------------");
}

displayMenu();
