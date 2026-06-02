/**
 * Exploratory Realistic User-Driven Evaluation Mode
 * This mode demonstrates how PADGF operates in a wallet-style user interface.
 * It does not overwrite official thesis data. Outputs are saved to results/custom_runs/.
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const {
    WETH_ADDRESS, USDC_ADDRESS, ROUTER_ADDRESS,
    IMPERSONATED_ACCOUNT, FORK_BLOCK, WETH_DECIMALS, USDC_DECIMALS
} = require("../src/constants.js");
const { setupProviderAndSigner } = require("../src/providerSetup.js");
const { getTokens, getRouter, getQuote, executeSwap } = require("../src/dexInteraction.js");
const { calculateRisk } = require("../src/riskEvaluator.js");

const CUSTOM_AMOUNT = process.env.CUSTOM_AMOUNT || "1.0";
const CUSTOM_SLIPPAGE = parseFloat(process.env.CUSTOM_SLIPPAGE || "1");
const DEMO_STAGE = process.env.DEMO_STAGE || "EVALUATE"; // EVALUATE or EXECUTE
const DEMO_USER_ACTION = process.env.DEMO_USER_ACTION || "auto_executed"; 
const DEMO_EXEC_TYPE = process.env.DEMO_EXEC_TYPE || "normal"; // normal, sandwich, none
const DEMO_GAS_SPEED = process.env.DEMO_GAS_SPEED || "standard";

const customDir = path.join(__dirname, "..", "results", "custom_runs");
if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });

function saveResult(data) {
    const filePath = path.join(customDir, "user_driven_decision_result.json");
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Exploratory result saved to: ${filePath}`);
}

async function run() {
    console.log(`[Exploratory Mode] Stage: ${DEMO_STAGE} | Input: ${CUSTOM_AMOUNT} WETH | Slippage: ${CUSTOM_SLIPPAGE}%`);

    // Reset the Hardhat fork to a clean state so the base fee doesn't accumulate
    // from previous runs and cause "maxFeePerGas too low" errors.
    await hre.network.provider.send("hardhat_reset", [{
        forking: {
            jsonRpcUrl: hre.config.networks.hardhat.forking.url,
            blockNumber: FORK_BLOCK
        }
    }]);

    const signers = await hre.ethers.getSigners();
    const signer = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
    const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
    const router = await getRouter(ROUTER_ADDRESS, signer);

    const amountIn = hre.ethers.parseUnits(CUSTOM_AMOUNT, WETH_DECIMALS);
    const swapPath = [WETH_ADDRESS, USDC_ADDRESS];

    // Reference Quote
    const referenceQuoteWei = await getQuote(router, amountIn, swapPath);
    const referenceOutput = hre.ethers.formatUnits(referenceQuoteWei, USDC_DECIMALS);

    // Dynamic Mempool Volatility Injection (Exploratory Condition)
    // To trigger different risk levels, we inject volatility based on input size.
    // Small < 10 -> Low (No volatility)
    // Med >=10 & <25 -> Moderate
    // High >= 25 -> High
    const amountVal = Number(CUSTOM_AMOUNT);
    const tau1 = 0.3;
    const tau2 = 0.7;

    let volatilityVol = 0;
    if (amountVal >= 10 && amountVal < 25) {
        volatilityVol = (amountVal * 25).toString(); // Inject heavy volume to guarantee Medium Risk > 0.3
    } else if (amountVal >= 25) {
        volatilityVol = (amountVal * 150).toString(); // Inject massive volume to guarantee High Risk > 0.7
    }

    if (volatilityVol > 0) {
        console.log(`[Exploratory Simulation] Generating controlled manipulated-pool-state condition: ${volatilityVol} WETH traded ahead...`);
        const mockAttacker = signers[2];
        const { weth: aWeth } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, mockAttacker);
        const aRouter = await getRouter(ROUTER_ADDRESS, mockAttacker);
        const aAmountIn = hre.ethers.parseUnits(volatilityVol, WETH_DECIMALS);
        
        await hre.network.provider.send("hardhat_setBalance", [mockAttacker.address, "0x152D02C7E14AF6800000"]); // 100,000 ETH
        const WETH_ABI_WRAP = ["function deposit() public payable"];
        const aWethContract = new hre.ethers.Contract(WETH_ADDRESS, WETH_ABI_WRAP, mockAttacker);
        await aWethContract.deposit({ value: aAmountIn, gasLimit: 100000, maxFeePerGas: hre.ethers.parseUnits("300", "gwei"), maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei") });
        
        try {
            const aQuote = await getQuote(aRouter, aAmountIn, swapPath);
            await executeSwap(aRouter, aWeth, aAmountIn, aQuote, swapPath, mockAttacker, 10);
        } catch (e) {
            console.log("[Simulation] Volatility induction hit pool limits, proceeding with max available stress.");
        }
    }

    // Simulated Quote after volatility
    const simulatedQuoteWei = await getQuote(router, amountIn, swapPath);
    const simulatedOutput = hre.ethers.formatUnits(simulatedQuoteWei, USDC_DECIMALS);

    const feeData = await hre.ethers.provider.getFeeData();
    const gasPriceWei = feeData.gasPrice || feeData.maxFeePerGas || hre.ethers.parseUnits("50", "gwei");

    // Estimate swap gas cost
    const estSwapGas = 150000n; // Typical Uniswap V2 swap gas limit
    const estimatedCostWei = gasPriceWei * estSwapGas;
    const estimatedCostEth = hre.ethers.formatEther(estimatedCostWei);

    // Calculate Risk
    const riskMetrics = calculateRisk(referenceOutput, simulatedOutput, gasPriceWei);
    const score = riskMetrics.normalized_risk_score;
    
    let riskLevel = "Low";
    let recommendation = "Execute Recommended";
    if (score >= tau2) {
        riskLevel = "High";
        recommendation = "Block Recommended";
    } else if (score >= tau1) {
        riskLevel = "Moderate";
        recommendation = "Delay Recommended";
    }

    // Base result structure
    let result = {
        run_type: "Exploratory Realistic User-Driven Evaluation Mode",
        official_thesis_data: false,
        exploratory_only: true,
        input_amount: CUSTOM_AMOUNT,
        slippage_tolerance: `${CUSTOM_SLIPPAGE}%`,
        reference_output: referenceOutput,
        simulated_output: simulatedOutput,
        actual_output: null,
        baseline_output: null, // used if attack happens
        victim_output_loss: null,
        financial_loss_percentage: null,
        slippage_deviation: riskMetrics.raw_slippage_deviation.toFixed(6),
        price_impact: riskMetrics.raw_price_impact.toFixed(6),
        gas_sensitivity: riskMetrics.raw_gas_sensitivity.toFixed(6),
        gas_speed_applied: DEMO_GAS_SPEED.toUpperCase(),
        normalized_risk_score: score.toFixed(6),
        estimated_gas_cost_eth: estimatedCostEth,
        estimated_gas_price_gwei: hre.ethers.formatUnits(gasPriceWei, "gwei"),
        tau1: tau1,
        tau2: tau2,
        risk_level: riskLevel,
        padgf_recommendation: recommendation,
        user_action: DEMO_USER_ACTION,
        execution_allowed: false,
        execution_status: "pending",
        transaction_hash: null,
        output_artifact: "results/custom_runs/user_driven_decision_result.json",
        timestamp: new Date().toISOString()
    };

    if (DEMO_STAGE === "EVALUATE") {
        saveResult(result);
        console.log(JSON.stringify(result, null, 2));
        return;
    } 

    if (DEMO_STAGE === "EXECUTE") {
        if (DEMO_EXEC_TYPE === "none" || DEMO_USER_ACTION === "cancelled") {
            result.execution_allowed = false;
            result.execution_status = "cancelled_by_user";
            saveResult(result);
            console.log(JSON.stringify(result, null, 2));
            return;
        }

        console.log(`[Exploratory Execution] Proceeding with ${DEMO_EXEC_TYPE} execution mode...`);
        const usdcBefore = await usdc.balanceOf(signer.address);

        if (DEMO_EXEC_TYPE === "sandwich") {
            // Front-run
            const attackerSigner = signers[1];
            const { weth: attackerWeth, usdc: attackerUsdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, attackerSigner);
            const attackerRouter = await getRouter(ROUTER_ADDRESS, attackerSigner);
            const attackerAmountIn = hre.ethers.parseUnits("5.0", WETH_DECIMALS);

            await hre.network.provider.send("hardhat_setBalance", [attackerSigner.address, "0x8AC7230489E80000"]); // 10 ETH
            const WETH_ABI_WRAP = ["function deposit() public payable"];
            const attackerWethContract = new hre.ethers.Contract(WETH_ADDRESS, WETH_ABI_WRAP, attackerSigner);
            await attackerWethContract.deposit({ 
                value: attackerAmountIn,
                gasLimit: 100000,
                maxFeePerGas: hre.ethers.parseUnits("300", "gwei"),
                maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei")
            });

            const attackerQuoteWei = await getQuote(attackerRouter, attackerAmountIn, swapPath);
            await executeSwap(attackerRouter, attackerWeth, attackerAmountIn, attackerQuoteWei, swapPath, attackerSigner, 5, "instant");
        }

        // Victim execute
        try {
            // If they continued despite a warning, this might fail or have high slippage loss
            const victimTx = await executeSwap(router, weth, amountIn, simulatedQuoteWei, swapPath, signer, CUSTOM_SLIPPAGE, DEMO_GAS_SPEED);
            result.transaction_hash = victimTx.hash;
            
            const usdcAfter = await usdc.balanceOf(signer.address);
            const actualOutputWei = usdcAfter - usdcBefore;
            const actualOutput = hre.ethers.formatUnits(actualOutputWei, USDC_DECIMALS);
            
            result.actual_output = actualOutput;
            result.execution_allowed = true;
            
            if (DEMO_EXEC_TYPE === "sandwich") {
                result.baseline_output = referenceOutput; // Assuming baseline is what we would've got without volatility
                const lossNum = Number(result.baseline_output) - Number(actualOutput);
                const lossPct = (lossNum / Number(result.baseline_output)) * 100;
                result.victim_output_loss = lossNum > 0 ? lossNum.toFixed(6) : "0.000000";
                result.financial_loss_percentage = lossPct > 0 ? `${lossPct.toFixed(2)}%` : "0.00%";
            }
            
            if (DEMO_USER_ACTION === "auto_executed") {
                result.execution_status = "executed_low_risk";
            } else if (DEMO_USER_ACTION === "accepted_delay_warning") {
                result.execution_status = "executed_after_delay_warning";
            } else if (DEMO_USER_ACTION === "accepted_high_warning") {
                result.execution_status = "executed_after_high_risk_warning";
            } else if (DEMO_USER_ACTION === "continued_despite_warning") {
                result.execution_status = "executed_after_warning";
            }
            
        } catch (error) {
            console.error("Execution failed:", error.message);
            result.execution_status = "failed: " + error.message;
            result.execution_allowed = true;
        }

        saveResult(result);
        console.log(JSON.stringify(result, null, 2));
    }
}

run().catch((error) => {
    console.error("User-Driven Mode Error:", error.message);
    process.exitCode = 1;
});
