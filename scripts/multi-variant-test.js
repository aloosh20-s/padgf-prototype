const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");
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
} = require("../src/dexInteraction.js");
const { calculateRisk } = require("../src/riskEvaluator.js");
const { makeDecision } = require("../src/decisionEngine.js");

async function runTestScenario(router, amountInEth, volatilityVol, weth, usdc, signer) {
    console.log(`\n--- Running Scenario: Victim=${amountInEth} WETH, Attacker Volatility=${volatilityVol} WETH ---`);
    
    const amountIn = hre.ethers.parseUnits(amountInEth.toString(), WETH_DECIMALS);
    const pathArray = [WETH_ADDRESS, USDC_ADDRESS];

    // Reset fork for a clean state
    await hre.network.provider.send("hardhat_reset", [
      {
        forking: {
          jsonRpcUrl: hre.config.networks.hardhat.forking.url,
          blockNumber: FORK_BLOCK,
        },
      },
    ]);

    // 1. Reference Quote
    const referenceQuoteWei = await getQuote(router, amountIn, pathArray);
    const referenceOutput = hre.ethers.formatUnits(referenceQuoteWei, USDC_DECIMALS);

    // Inject Volatility
    if (volatilityVol > 0) {
      const signers = await hre.ethers.getSigners();
      const mockAttacker = signers[2];
      const aRouter = await getRouter(ROUTER_ADDRESS, mockAttacker);
      const aAmountIn = hre.ethers.parseUnits(volatilityVol.toString(), WETH_DECIMALS);

      await hre.network.provider.send("hardhat_setBalance", [mockAttacker.address, "0x152D02C7E14AF6800000"]); 
      const WETH_ABI_WRAP = ["function deposit() public payable"];
      const aWethContract = new hre.ethers.Contract(WETH_ADDRESS, WETH_ABI_WRAP, mockAttacker);
      await aWethContract.deposit({ value: aAmountIn, gasLimit: 100000 });

      try {
        const aQuote = await getQuote(aRouter, aAmountIn, pathArray);
        
        // Execute attack swap
        const approveTx = await aWethContract.approve(await aRouter.getAddress(), aAmountIn);
        await approveTx.wait();
        const deadline = (await hre.ethers.provider.getBlock("latest")).timestamp + 1200;
        const swapTx = await aRouter.swapExactTokensForTokens(
          aAmountIn,
          0,
          pathArray,
          mockAttacker.address,
          deadline,
          { gasLimit: 300000 }
        );
        await swapTx.wait();
      } catch (e) {
        console.log("  [!] Volatility induction failed or hit limits.");
      }
    }

    // 2. Pre-Broadcast Simulation
    const evalStartTime = performance.now();
    const simulatedQuoteWei = await getQuote(router, amountIn, pathArray);
    const simulatedOutput = hre.ethers.formatUnits(simulatedQuoteWei, USDC_DECIMALS);

    const feeData = await hre.ethers.provider.getFeeData();
    const gasPriceWei = feeData.gasPrice || feeData.maxFeePerGas || hre.ethers.parseUnits("50", "gwei");

    // 3. Compute Risk Attributes
    const riskMetrics = calculateRisk(
      amountInEth.toString(),
      referenceOutput,
      simulatedOutput,
      gasPriceWei,
    );

    // 4. Apply Decision Engine
    const decisionThresholds = { tau1: 0.3, tau2: 0.7 };
    const decisionResult = makeDecision(
      riskMetrics.normalized_risk_score,
      decisionThresholds,
    );
    const evalEndTime = performance.now();
    
    console.log(`  Decision: ${decisionResult.decision} | Risk Score: ${riskMetrics.normalized_risk_score.toFixed(4)} | Latency: ${(evalEndTime - evalStartTime).toFixed(2)} ms`);

    return {
        victim_input_weth: amountInEth,
        attacker_volatility_weth: volatilityVol,
        reference_output_usdc: referenceOutput,
        simulated_output_usdc: simulatedOutput,
        slippage_deviation: riskMetrics.raw_slippage_deviation,
        normalized_risk_score: riskMetrics.normalized_risk_score,
        decision: decisionResult.decision,
        execution_allowed: decisionResult.execution_allowed,
        latency_ms: evalEndTime - evalStartTime
    };
}

async function main() {
  console.log("Starting Multi-Variant Testing...");

  const signer = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
  const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
  const router = await getRouter(ROUTER_ADDRESS, signer);

  const victimInputs = [0.5, 5, 20, 50];
  const attackerCapitals = [0, 10, 50, 200];

  const results = [];

  for (const vInput of victimInputs) {
      for (const aCapital of attackerCapitals) {
          const res = await runTestScenario(router, vInput, aCapital, weth, usdc, signer);
          results.push(res);
      }
  }

  const resultsDir = path.join(__dirname, "..", "results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  const filePath = path.join(resultsDir, "multi_variant_results.json");
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2));

  console.log(`\n✅ Multi-Variant Testing Complete. Results saved to: ${filePath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
