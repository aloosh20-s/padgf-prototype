const hre = require("hardhat");
const {
  WETH_ADDRESS,
  USDC_ADDRESS,
  ROUTER_ADDRESS,
  IMPERSONATED_ACCOUNT,
  FORK_BLOCK,
  WETH_DECIMALS,
  USDC_DECIMALS,
} = require("../src/constants.js");
const { setupProviderAndSigner } = require("../src/providerSetup.js");
const {
  getTokens,
  getRouter,
  getQuote,
  executeSwap,
} = require("../src/dexInteraction.js");
const { formatOutput, saveResult } = require("../src/resultLogger.js");
const { calculateRisk } = require("../src/riskEvaluator.js");
const { makeDecision } = require("../src/decisionEngine.js");

async function main() {
  console.log("Starting Phase 3: PADGF Protected Swap...");

  try {
    // Reset fork to clean state to prevent accumulated base fee errors
    await hre.network.provider.send("hardhat_reset", [
      {
        forking: {
          jsonRpcUrl: hre.config.networks.hardhat.forking.url,
          blockNumber: FORK_BLOCK,
        },
      },
    ]);

    const signer = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
    console.log(`User account: ${signer.address}`);

    const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
    const router = await getRouter(ROUTER_ADDRESS, signer);

    const amountInEth = "14";
    const amountIn = hre.ethers.parseUnits(amountInEth, WETH_DECIMALS);
    const path = [WETH_ADDRESS, USDC_ADDRESS];

    // 1. Obtain Reference Quote (Current pristine state)
    console.log("Fetching reference quote...");
    const referenceQuoteWei = await getQuote(router, amountIn, path);
    const referenceOutput = hre.ethers.formatUnits(
      referenceQuoteWei,
      USDC_DECIMALS,
    );
    console.log(`Reference Output: ${referenceOutput} USDC`);

    // 2. Pre-Broadcast Simulation
    // We evaluate pre-broadcast transaction parameters before the transaction enters the public mempool.
    console.log("Analyzing pre-broadcast transaction parameters...");
    const simulatedQuoteWei = await getQuote(router, amountIn, path);
    const simulatedOutput = hre.ethers.formatUnits(
      simulatedQuoteWei,
      USDC_DECIMALS,
    );
    console.log(`Simulated Expected Output: ${simulatedOutput} USDC`);

    // Get current gas price
    const feeData = await hre.ethers.provider.getFeeData();
    const gasPriceWei =
      feeData.gasPrice ||
      feeData.maxFeePerGas ||
      hre.ethers.parseUnits("50", "gwei");

    // 3. Compute Risk Attributes
    const riskMetrics = calculateRisk(
      amountInEth,
      referenceOutput,
      simulatedOutput,
      gasPriceWei,
    );
    console.log(
      `Calculated Normalized Risk Score: ${riskMetrics.normalized_risk_score.toFixed(4)}`,
    );

    // 4. Apply Decision Engine
    // Base thresholds
    const decisionThresholds = { tau1: 0.3, tau2: 0.7 };
    const decisionResult = makeDecision(
      riskMetrics.normalized_risk_score,
      decisionThresholds,
    );

    console.log(`PADGF Decision: [${decisionResult.decision}]`);
    console.log(`Reasoning: ${decisionResult.reason}`);

    let executionStatus = decisionResult.decision;
    let transactionHash = "";
    let actualOutputWei = 0n;

    // 5. Execute only if allowed
    if (decisionResult.execution_allowed) {
      console.log("Executing protected swap...");
      const slippageTolerance = 1; // 1%

      const usdcBalanceBefore = await usdc.balanceOf(signer.address);

      const receipt = await executeSwap(
        router,
        weth,
        amountIn,
        simulatedQuoteWei,
        path,
        signer,
        slippageTolerance,
      );

      const usdcBalanceAfter = await usdc.balanceOf(signer.address);
      actualOutputWei = usdcBalanceAfter - usdcBalanceBefore;

      transactionHash = receipt.hash;
      executionStatus = "success";

      console.log(`Swap Success! Hash: ${transactionHash}`);
      console.log(
        `Final Output: ${hre.ethers.formatUnits(actualOutputWei, USDC_DECIMALS)} USDC`,
      );
    } else {
      console.log("Execution bypassed by PADGF.");
    }

    // 6. Save results
    const finalOutputStr =
      actualOutputWei > 0n
        ? hre.ethers.formatUnits(actualOutputWei, USDC_DECIMALS)
        : simulatedOutput;

    const resultData = formatOutput({
      scenario_name: "Phase 3 Protected Swap",
      fork_block: FORK_BLOCK,
      dex: "Uniswap V2",
      input_token: "WETH",
      output_token: "USDC",
      input_amount: amountInEth,
      reference_output: referenceOutput,
      simulated_output: simulatedOutput,
      slippage_deviation: riskMetrics.raw_slippage_deviation.toString(),
      price_impact: riskMetrics.price_impact.toString(),
      eth_price_estimate: riskMetrics.eth_price_estimate.toString(),
      attacker_gross_profit_usdc:
        riskMetrics.attacker_gross_profit_usdc.toString(),
      attacker_gas_cost_usdc: riskMetrics.attacker_gas_cost_usdc.toString(),
      attacker_net_profit_usdc: riskMetrics.attacker_net_profit_usdc.toString(),
      profitability_ratio: riskMetrics.profitability_ratio.toString(),
      normalized_risk_score: riskMetrics.normalized_risk_score.toString(),
      threshold_values: decisionResult.thresholds,
      padgf_decision: decisionResult.decision,
      execution_allowed: decisionResult.execution_allowed,
      execution_status: executionStatus,
      transaction_hash: transactionHash,
    });

    saveResult(resultData, "protected_swap_result.json");
  } catch (error) {
    console.error("Execution Error:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
