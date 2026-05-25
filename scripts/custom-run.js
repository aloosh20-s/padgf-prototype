/**
 * Custom Run Script
 * This script is invoked by the dashboard for exploratory test scenarios.
 * It reads parameters from environment variables set by the server:
 *   CUSTOM_AMOUNT   - WETH input amount (e.g. "0.5", "1.0", "2.0", "5.0")
 *   CUSTOM_SLIPPAGE - Slippage tolerance percentage (e.g. "0.5", "1", "2")
 *   CUSTOM_SCENARIO - "baseline" | "sandwich" | "protected"
 *
 * Results are written to results/custom_runs/ and never overwrite the official thesis files.
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
const { makeDecision } = require("../src/decisionEngine.js");

const CUSTOM_AMOUNT = process.env.CUSTOM_AMOUNT || "1.0";
const CUSTOM_SLIPPAGE = parseFloat(process.env.CUSTOM_SLIPPAGE || "1");
const CUSTOM_SCENARIO = process.env.CUSTOM_SCENARIO || "baseline";

const customDir = path.join(__dirname, "..", "results", "custom_runs");
if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });

function saveCustomResult(data, filename) {
    const filePath = path.join(customDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    console.log(`Custom result saved to: ${filePath}`);
}

async function runBaseline() {
    console.log(`[Exploratory Test] Baseline Swap | ${CUSTOM_AMOUNT} WETH | ${CUSTOM_SLIPPAGE}% slippage`);
    const signer = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
    const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
    const router = await getRouter(ROUTER_ADDRESS, signer);

    const amountIn = hre.ethers.parseUnits(CUSTOM_AMOUNT, WETH_DECIMALS);
    const swapPath = [WETH_ADDRESS, USDC_ADDRESS];

    const expectedOutputWei = await getQuote(router, amountIn, swapPath);
    const expectedOutput = hre.ethers.formatUnits(expectedOutputWei, USDC_DECIMALS);

    const usdcBefore = await usdc.balanceOf(signer.address);
    const receipt = await executeSwap(router, weth, amountIn, expectedOutputWei, swapPath, signer, CUSTOM_SLIPPAGE);
    const usdcAfter = await usdc.balanceOf(signer.address);
    const actualOutputWei = usdcAfter - usdcBefore;
    const actualOutput = hre.ethers.formatUnits(actualOutputWei, USDC_DECIMALS);

    const result = {
        run_type: "Exploratory Test",
        scenario: "Baseline Swap",
        fork_block: FORK_BLOCK,
        dex: "Uniswap V2",
        input_token: "WETH",
        output_token: "USDC",
        input_amount: CUSTOM_AMOUNT,
        slippage_tolerance: `${CUSTOM_SLIPPAGE}%`,
        expected_output: expectedOutput,
        actual_output: actualOutput,
        gas_used: receipt.gasUsed.toString(),
        transaction_hash: receipt.hash,
        execution_status: "success",
        timestamp: new Date().toISOString()
    };
    saveCustomResult(result, "custom_baseline.json");
    console.log(JSON.stringify(result, null, 2));
}

async function runSandwich() {
    console.log(`[Exploratory Test] Sandwich Attack | Victim: ${CUSTOM_AMOUNT} WETH | ${CUSTOM_SLIPPAGE}% slippage`);
    const victimSigner = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
    const signers = await hre.ethers.getSigners();
    const attackerSigner = signers[0];

    const { weth: victimWeth, usdc: victimUsdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, victimSigner);
    const { weth: attackerWeth, usdc: attackerUsdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, attackerSigner);
    const victimRouter = await getRouter(ROUTER_ADDRESS, victimSigner);
    const attackerRouter = await getRouter(ROUTER_ADDRESS, attackerSigner);

    const victimAmountIn = hre.ethers.parseUnits(CUSTOM_AMOUNT, WETH_DECIMALS);
    const attackerAmountInEth = "5.0";
    const attackerAmountIn = hre.ethers.parseUnits(attackerAmountInEth, WETH_DECIMALS);

    await hre.network.provider.send("hardhat_setBalance", [
        attackerSigner.address, "0x8AC7230489E80000"
    ]);
    const WETH_ABI_WRAP = ["function deposit() public payable"];
    const attackerWethContract = new hre.ethers.Contract(WETH_ADDRESS, WETH_ABI_WRAP, attackerSigner);
    await attackerWethContract.deposit({ value: attackerAmountIn });

    const swapPath = [WETH_ADDRESS, USDC_ADDRESS];
    const reversePath = [USDC_ADDRESS, WETH_ADDRESS];

    const baselineQuoteWei = await getQuote(victimRouter, victimAmountIn, swapPath);
    const baselineExpected = hre.ethers.formatUnits(baselineQuoteWei, USDC_DECIMALS);

    const victimUsdcBefore = await victimUsdc.balanceOf(victimSigner.address);

    // Front-run
    const attackerQuoteWei = await getQuote(attackerRouter, attackerAmountIn, swapPath);
    const frontrunTx = await executeSwap(attackerRouter, attackerWeth, attackerAmountIn, attackerQuoteWei, swapPath, attackerSigner, 5);

    // Victim swap
    const victimTx = await executeSwap(victimRouter, victimWeth, victimAmountIn, baselineQuoteWei, swapPath, victimSigner, CUSTOM_SLIPPAGE);

    // Back-run
    const attackerUsdcBal = await attackerUsdc.balanceOf(attackerSigner.address);
    const backrunQuoteWei = await getQuote(attackerRouter, attackerUsdcBal, reversePath);
    const backrunTx = await executeSwap(attackerRouter, attackerUsdc, attackerUsdcBal, backrunQuoteWei, reversePath, attackerSigner, 5);

    const victimUsdcAfter = await victimUsdc.balanceOf(victimSigner.address);
    const victimActualWei = victimUsdcAfter - victimUsdcBefore;
    const attackedActual = hre.ethers.formatUnits(victimActualWei, USDC_DECIMALS);

    const lossNum = Number(baselineExpected) - Number(attackedActual);
    const lossPct = (lossNum / Number(baselineExpected)) * 100;

    const result = {
        run_type: "Exploratory Test",
        scenario: "Sandwich Attack Simulation",
        fork_block: FORK_BLOCK,
        dex: "Uniswap V2",
        input_token: "WETH",
        output_token: "USDC",
        victim_input_amount: CUSTOM_AMOUNT,
        slippage_tolerance: `${CUSTOM_SLIPPAGE}%`,
        baseline_expected_output: baselineExpected,
        attacked_actual_output: attackedActual,
        victim_output_loss: lossNum.toFixed(6),
        financial_loss_percentage: `${lossPct.toFixed(2)}%`,
        attacker_gas_used: (frontrunTx.gasUsed + backrunTx.gasUsed).toString(),
        victim_gas_used: victimTx.gasUsed.toString(),
        frontrun_hash: frontrunTx.hash,
        victim_hash: victimTx.hash,
        backrun_hash: backrunTx.hash,
        execution_status: "success",
        timestamp: new Date().toISOString()
    };
    saveCustomResult(result, "custom_sandwich.json");
    console.log(JSON.stringify(result, null, 2));
}

async function runProtected() {
    console.log(`[Exploratory Test] PADGF Protected | ${CUSTOM_AMOUNT} WETH | ${CUSTOM_SLIPPAGE}% slippage`);
    const signer = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
    const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
    const router = await getRouter(ROUTER_ADDRESS, signer);

    const amountIn = hre.ethers.parseUnits(CUSTOM_AMOUNT, WETH_DECIMALS);
    const swapPath = [WETH_ADDRESS, USDC_ADDRESS];

    const referenceQuoteWei = await getQuote(router, amountIn, swapPath);
    const referenceOutput = hre.ethers.formatUnits(referenceQuoteWei, USDC_DECIMALS);

    const simulatedQuoteWei = await getQuote(router, amountIn, swapPath);
    const simulatedOutput = hre.ethers.formatUnits(simulatedQuoteWei, USDC_DECIMALS);

    const feeData = await hre.ethers.provider.getFeeData();
    const gasPriceWei = feeData.gasPrice || feeData.maxFeePerGas || hre.ethers.parseUnits("50", "gwei");

    const riskMetrics = calculateRisk(referenceOutput, simulatedOutput, gasPriceWei);
    const decisionResult = makeDecision(riskMetrics.normalized_risk_score, { tau1: 0.3, tau2: 0.7 });

    let executionStatus = "Blocked / Delayed";
    let transactionHash = "";
    let actualOutputWei = 0n;

    if (decisionResult.execution_allowed) {
        const usdcBefore = await usdc.balanceOf(signer.address);
        const receipt = await executeSwap(router, weth, amountIn, simulatedQuoteWei, swapPath, signer, CUSTOM_SLIPPAGE);
        const usdcAfter = await usdc.balanceOf(signer.address);
        actualOutputWei = usdcAfter - usdcBefore;
        transactionHash = receipt.hash;
        executionStatus = "success";
    }

    const finalOut = actualOutputWei > 0n ? hre.ethers.formatUnits(actualOutputWei, USDC_DECIMALS) : simulatedOutput;

    const result = {
        run_type: "Exploratory Test",
        scenario: "PADGF Protected Evaluation",
        fork_block: FORK_BLOCK,
        dex: "Uniswap V2",
        input_token: "WETH",
        output_token: "USDC",
        input_amount: CUSTOM_AMOUNT,
        slippage_tolerance: `${CUSTOM_SLIPPAGE}%`,
        reference_output: referenceOutput,
        simulated_output: simulatedOutput,
        actual_output: finalOut,
        slippage_deviation: riskMetrics.raw_slippage_deviation.toString(),
        price_impact: riskMetrics.raw_price_impact.toString(),
        gas_sensitivity: riskMetrics.raw_gas_sensitivity.toString(),
        normalized_risk_score: riskMetrics.normalized_risk_score.toString(),
        threshold_values: decisionResult.thresholds,
        padgf_decision: decisionResult.decision,
        execution_allowed: decisionResult.execution_allowed,
        execution_status: executionStatus,
        transaction_hash: transactionHash,
        timestamp: new Date().toISOString()
    };
    saveCustomResult(result, "custom_protected.json");
    console.log(JSON.stringify(result, null, 2));
}

async function main() {
    if (CUSTOM_SCENARIO === "baseline") await runBaseline();
    else if (CUSTOM_SCENARIO === "sandwich") await runSandwich();
    else if (CUSTOM_SCENARIO === "protected") await runProtected();
    else { console.error("Unknown scenario:", CUSTOM_SCENARIO); process.exit(1); }
}

main().catch((error) => {
    console.error("Custom run error:", error.message);
    process.exitCode = 1;
});
