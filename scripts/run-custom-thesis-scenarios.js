const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
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
const { calculateRisk } = require("../src/riskEvaluator.js");
const { makeDecision } = require("../src/decisionEngine.js");

const customDir = path.join(__dirname, "..", "results", "custom_runs");
if (!fs.existsSync(customDir)) fs.mkdirSync(customDir, { recursive: true });

async function resetNetwork() {
  await hre.network.provider.send("hardhat_reset", [
    {
      forking: {
        jsonRpcUrl: hre.config.networks.hardhat.forking.url,
        blockNumber: FORK_BLOCK,
      },
    },
  ]);
}

async function runScenario(scenarioData) {
  const { name, targetRisk, jsonFilename, gasPriceGwei, maxSlippageTolerance } =
    scenarioData;
  console.log(`\nRunning ${name}... target: ${targetRisk}`);

  let bestParams = null;
  let found = false;

  // We will search for a frontrun amount that yields the right risk score
  // using purely getQuote to simulate.
  const searchSigner = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
  const mockAttacker = (await hre.ethers.getSigners())[2];

  for (let frontrunAmt of [0, 5, 10, 20, 50, 80, 120, 200, 300, 500]) {
    await resetNetwork();
    const signer = await setupProviderAndSigner(IMPERSONATED_ACCOUNT);
    const { weth, usdc } = await getTokens(WETH_ADDRESS, USDC_ADDRESS, signer);
    const router = await getRouter(ROUTER_ADDRESS, signer);

    const aRouter = await getRouter(ROUTER_ADDRESS, mockAttacker);
    const { weth: aWeth } = await getTokens(
      WETH_ADDRESS,
      USDC_ADDRESS,
      mockAttacker,
    );

    const amountInEth = "10.0";
    const amountIn = hre.ethers.parseUnits(amountInEth, WETH_DECIMALS);
    const swapPath = [WETH_ADDRESS, USDC_ADDRESS];

    const referenceQuoteWei = await getQuote(router, amountIn, swapPath);
    const referenceOutput = hre.ethers.formatUnits(
      referenceQuoteWei,
      USDC_DECIMALS,
    );

    if (frontrunAmt > 0) {
      const aAmountIn = hre.ethers.parseUnits(
        frontrunAmt.toString(),
        WETH_DECIMALS,
      );
      await hre.network.provider.send("hardhat_setBalance", [
        mockAttacker.address,
        "0x152D02C7E14AF6800000",
      ]);
      const WETH_ABI_WRAP = ["function deposit() public payable"];
      const aWethContract = new hre.ethers.Contract(
        WETH_ADDRESS,
        WETH_ABI_WRAP,
        mockAttacker,
      );
      await aWethContract.deposit({ value: aAmountIn, gasLimit: 100000 });

      try {
        const aQuote = await getQuote(aRouter, aAmountIn, swapPath);
        await executeSwap(
          aRouter,
          aWeth,
          aAmountIn,
          aQuote,
          swapPath,
          mockAttacker,
          10,
        );
      } catch (e) {
        // Ignore swap failures on very high amounts
      }
    }

    const simulatedQuoteWei = await getQuote(router, amountIn, swapPath);
    const simulatedOutput = hre.ethers.formatUnits(
      simulatedQuoteWei,
      USDC_DECIMALS,
    );

    const gasPriceWei = hre.ethers.parseUnits(gasPriceGwei.toString(), "gwei");
    const riskMetrics = calculateRisk(
      amountInEth,
      referenceOutput,
      simulatedOutput,
      gasPriceWei,
    );
    const decisionResult = makeDecision(riskMetrics.normalized_risk_score, {
      tau1: 0.3,
      tau2: 0.7,
    });

    const msg = `  -> Validating frontrun=${frontrunAmt}: score=${riskMetrics.normalized_risk_score.toFixed(4)}, profit=${riskMetrics.attacker_net_profit_usdc.toFixed(2)}, slippage=${riskMetrics.raw_slippage_deviation.toFixed(2)}, decision=${decisionResult.decision}\n`;
    fs.appendFileSync(path.join(__dirname, "..", "debug.log"), msg);
    console.log(msg);

    let matches = false;
    if (targetRisk === "Low" && decisionResult.decision === "Execute")
      matches = true;
    if (targetRisk === "Moderate" && decisionResult.decision === "Delay")
      matches = true;
    if (targetRisk === "High" && decisionResult.decision === "Block")
      matches = true;

    if (matches) {
      console.log(
        `Found matching params: frontrun=${frontrunAmt} WETH. Score=${riskMetrics.normalized_risk_score.toFixed(4)}, Decision=${decisionResult.decision}`,
      );

      let executionStatus = decisionResult.decision;
      let transactionHash = "";
      let actualOutputWei = BigInt(simulatedQuoteWei); // default to simulated
      // If the decision allows execution, we run it
      if (decisionResult.execution_allowed) {
        const usdcBefore = await usdc.balanceOf(signer.address);
        const receipt = await executeSwap(
          router,
          weth,
          amountIn,
          simulatedQuoteWei,
          swapPath,
          signer,
          maxSlippageTolerance,
        );
        const usdcAfter = await usdc.balanceOf(signer.address);
        actualOutputWei = usdcAfter - usdcBefore;
        transactionHash = receipt.hash;
        executionStatus = "success";
      }

      const actualOutput = hre.ethers.formatUnits(
        actualOutputWei,
        USDC_DECIMALS,
      );
      const outputDeviationStr = (
        Number(referenceOutput) - Number(actualOutput)
      ).toFixed(6);

      const result = {
        run_type: "Custom Scenario Evaluation",
        official_thesis_data: false,
        exploratory_only: true,
        scenario_name: name,
        risk_category_target: targetRisk,
        fork_block: FORK_BLOCK,
        dex_protocol: "Uniswap V2",
        token_pair: "WETH/USDC",
        input_amount: amountInEth,
        slippage_tolerance: `${maxSlippageTolerance}%`,
        reference_output: referenceOutput,
        simulated_output: simulatedOutput,
        actual_output: actualOutput,
        output_deviation: outputDeviationStr,
        slippage_deviation: riskMetrics.raw_slippage_deviation.toFixed(4) + "%",
        price_impact: riskMetrics.price_impact.toFixed(4) + "%",
        normalized_risk_score: riskMetrics.normalized_risk_score.toFixed(4),
        tau1: 0.3,
        tau2: 0.7,
        risk_level: targetRisk,
        padgf_decision: decisionResult.decision,
        execution_allowed: decisionResult.execution_allowed,
        execution_status: executionStatus,
        estimated_gas_cost_eth: "0.005", // Mock estimation
        estimated_gas_price_gwei: gasPriceGwei.toString(),
        transaction_hash: transactionHash,
        notes: `Achieved with frontrun volume of ${frontrunAmt} WETH and gas price ${gasPriceGwei} gwei.`,
        artifact_filename: jsonFilename,
      };

      bestParams = result;
      found = true;
      fs.writeFileSync(
        path.join(customDir, jsonFilename),
        JSON.stringify(result, null, 2),
      );
      break;
    }
  }

  if (!found) {
    throw new Error(
      `Could not find parameters to satisfy ${targetRisk} risk criteria.`,
    );
  }

  return bestParams;
}

async function main() {
  try {
    console.log("Starting custom scenarios generation...");

    const results = [];

    // Low Risk: No frontrun, standard gas
    results.push(
      await runScenario({
        name: "Custom Low-Risk Case",
        targetRisk: "Low",
        jsonFilename: "custom_low_risk_result.json",
        gasPriceGwei: 30,
        maxSlippageTolerance: 1.0,
      }),
    );

    // Moderate Risk: Moderate frontrun to cause some slippage, med gas
    results.push(
      await runScenario({
        name: "Custom Moderate-Risk Case",
        targetRisk: "Moderate",
        jsonFilename: "custom_moderate_risk_result.json",
        gasPriceGwei: 80,
        maxSlippageTolerance: 2.0,
      }),
    );

    // High Risk: High frontrun to cause large slippage, high gas
    results.push(
      await runScenario({
        name: "Custom High-Risk Case",
        targetRisk: "High",
        jsonFilename: "custom_high_risk_result.json",
        gasPriceGwei: 150,
        maxSlippageTolerance: 5.0,
      }),
    );

    const csvPath = path.join(customDir, "custom_scenario_summary.csv");
    let csvContent =
      "scenario_name,risk_category_target,input_amount,slippage_tolerance,reference_output,simulated_output,actual_output,output_deviation,slippage_deviation,price_impact,normalized_risk_score,risk_level,padgf_decision,execution_allowed,execution_status,estimated_gas_cost_eth,estimated_gas_price_gwei,artifact_filename\n";

    for (const r of results) {
      csvContent += `${r.scenario_name},${r.risk_category_target},${r.input_amount},${r.slippage_tolerance},${r.reference_output},${r.simulated_output},${r.actual_output},${r.output_deviation},${r.slippage_deviation},${r.price_impact},${r.normalized_risk_score},${r.risk_level},${r.padgf_decision},${r.execution_allowed},${r.execution_status},${r.estimated_gas_cost_eth},${r.estimated_gas_price_gwei},${r.artifact_filename}\n`;
    }

    fs.writeFileSync(csvPath, csvContent);
    console.log(`\nSaved CSV summary to ${csvPath}`);

    // Print summary terminal table
    console.log(
      "\n| Scenario | Input Amount | Slippage Tolerance | Reference Output | Simulated/Actual Output | Slippage Deviation | Price Impact | Risk Score | Risk Level | PADGF Decision | Execution Status |",
    );
    console.log(
      "| -------- | -----------: | -----------------: | ---------------: | ----------------------: | -----------------: | -----------: | ---------: | ---------- | -------------- | ---------------- |",
    );

    for (const r of results) {
      let simActOut = `${Number(r.simulated_output).toFixed(2)} / ${Number(r.actual_output).toFixed(2)}`;
      if (r.simulated_output === r.actual_output)
        simActOut = `${Number(r.actual_output).toFixed(2)}`;
      console.log(
        `| ${r.scenario_name.padEnd(8)} | ${r.input_amount.padStart(12)} | ${r.slippage_tolerance.padStart(18)} | ${Number(r.reference_output).toFixed(2).padStart(16)} | ${simActOut.padStart(23)} | ${r.slippage_deviation.padStart(18)} | ${r.price_impact.padStart(12)} | ${r.normalized_risk_score.padStart(10)} | ${r.risk_level.padEnd(10)} | ${r.padgf_decision.padEnd(14)} | ${r.execution_status.padEnd(16)} |`,
      );
    }
  } catch (err) {
    fs.appendFileSync(
      path.join(__dirname, "..", "debug.log"),
      `MAIN ERROR: ${err.stack}\n`,
    );
  }
}

main().catch((err) => {
  fs.appendFileSync(
    path.join(__dirname, "..", "debug.log"),
    `TOP LEVEL ERROR: ${err.stack}\n`,
  );
});
