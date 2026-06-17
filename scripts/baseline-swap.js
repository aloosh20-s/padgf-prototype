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

async function main() {
  console.log("Starting Baseline Swap Simulation...");
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
    console.log(`Impersonated account: ${signer.address}`);

    const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
    const router = await getRouter(ROUTER_ADDRESS, signer);

    const amountInEth = "14";
    const amountIn = hre.ethers.parseUnits(amountInEth, WETH_DECIMALS);
    const path = [WETH_ADDRESS, USDC_ADDRESS];

    console.log("Fetching quote on Uniswap V2...");
    const expectedOutputWei = await getQuote(router, amountIn, path);
    const expectedOutput = hre.ethers.formatUnits(
      expectedOutputWei,
      USDC_DECIMALS,
    );
    console.log(`Expected output: ${expectedOutput} USDC`);

    const usdcBalanceBefore = await usdc.balanceOf(signer.address);

    const slippageTolerance = 1; // 1%
    console.log(
      `Executing swap with ${slippageTolerance}% slippage tolerance...`,
    );
    const receipt = await executeSwap(
      router,
      weth,
      amountIn,
      expectedOutputWei,
      path,
      signer,
      slippageTolerance,
    );

    const usdcBalanceAfter = await usdc.balanceOf(signer.address);
    const actualOutputWei = usdcBalanceAfter - usdcBalanceBefore;
    const actualOutput = hre.ethers.formatUnits(actualOutputWei, USDC_DECIMALS);
    console.log(`Actual output: ${actualOutput} USDC`);

    // Validation Checks
    if (receipt.status !== 1)
      throw new Error(
        "Validation Failed: Transaction status is not 1 (success).",
      );
    if (actualOutputWei <= 0n)
      throw new Error("Validation Failed: Actual output is 0 or less.");
    if (!receipt.gasUsed || receipt.gasUsed <= 0n)
      throw new Error("Validation Failed: Gas usage not properly recorded.");

    const resultData = formatOutput({
      scenario_name: "Phase 1 Baseline",
      fork_block: FORK_BLOCK,
      dex: "Uniswap V2",
      input_token: "WETH",
      output_token: "USDC",
      input_amount: amountInEth,
      slippage_tolerance: `${slippageTolerance}%`,
      expected_output: expectedOutput,
      actual_output: actualOutput,
      gas_used: receipt.gasUsed.toString(),
      transaction_hash: receipt.hash,
      execution_status: "success",
    });

    saveResult(resultData, "baseline_result.json");
    console.log("Result Payload:");
    console.log(JSON.stringify(resultData, null, 2));
  } catch (error) {
    console.error("Execution Error:", error.message);

    const errorData = formatOutput({
      scenario_name: "Phase 1 Baseline",
      fork_block: FORK_BLOCK,
      dex: "Uniswap V2",
      input_token: "WETH",
      output_token: "USDC",
      input_amount: "14",
      slippage_tolerance: "1%",
      expected_output: "0",
      actual_output: "0",
      gas_used: "0",
      transaction_hash: "N/A",
      execution_status: `error: ${error.message}`,
    });

    const fs = require("fs");
    const path = require("path");
    const resultsDir = path.join(__dirname, "..", "results");
    if (!fs.existsSync(resultsDir))
      fs.mkdirSync(resultsDir, { recursive: true });
    fs.writeFileSync(
      path.join(resultsDir, "baseline_error.json"),
      JSON.stringify(errorData, null, 2),
    );

    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
