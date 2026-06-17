const inquirer = require("inquirer");
const chalk = require("chalk");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const ora = require("ora");
const figlet = require("figlet");
const Table = require("cli-table3");

// Clear screen
process.stdout.write('\x1Bc');

const displayHeader = () => {
  console.log(
    chalk.cyan(
      figlet.textSync("PADGF", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default",
      })
    )
  );
  console.log(chalk.yellow.bold("   PreSend Adaptive Decision Guard Framework"));
  console.log(chalk.cyan.bold("=================================================="));
};

const displayMenu = async () => {
  displayHeader();

  const answer = await inquirer.prompt([
    {
      type: "list",
      name: "option",
      message: "Select a simulation module:",
      choices: [
        { name: "1. Run: Baseline Swap", value: "1" },
        { name: "2. Run: Sandwich Attack Simulation", value: "2" },
        { name: "3. Run: PADGF Protected Swap", value: "3" },
        { name: "4. View Latest Phase 3 Results", value: "4" },
        { name: "5. Exit", value: "5" },
      ],
    },
  ]);

  handleOption(answer.option);
};

const handleOption = (opt) => {
  if (opt === "5") {
    console.log(chalk.green("Exiting PADGF Demo Environment..."));
    process.exit(0);
  }

  if (opt === "4") {
    console.log(chalk.magenta.bold("\n--- LATEST PROTECTED SWAP RESULTS ---"));
    const resPath = path.join(
      __dirname,
      "..",
      "results",
      "protected_swap_result.json"
    );
    if (fs.existsSync(resPath)) {
      const data = JSON.parse(fs.readFileSync(resPath));
      printSummaryTable(data);
    } else {
      console.log(chalk.red("No results found. Run Phase 3 first."));
    }
    console.log("\n");
    
    // Prompt to continue
    inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press Enter to return to the main menu...'
    }]).then(() => {
        process.stdout.write('\x1Bc');
        displayMenu();
    });
    return;
  }

  let scriptPath = "";
  let spinnerText = "";

  if (opt === "1") {
    scriptPath = "scripts/baseline-swap.js";
    spinnerText = "Executing Phase 1: Baseline Swap on deterministic fork...";
  } else if (opt === "2") {
    scriptPath = "scripts/sandwich-attack.js";
    spinnerText = "Executing Phase 2: Simulating Sandwich Attack vectors...";
  } else if (opt === "3") {
    scriptPath = "scripts/protected-swap.js";
    spinnerText = "Executing Phase 3: PADGF Pre-Broadcast Risk Evaluation...";
  }

  const spinner = ora({
    text: chalk.blue(spinnerText),
    color: 'cyan'
  }).start();

  const command = `npx hardhat run ${scriptPath} --network localhost`;

  exec(command, (error, stdout, stderr) => {
    if (error) {
        spinner.fail(chalk.red(`Execution Failed: ${error.message}`));
    } else if (stderr && stderr.includes("Error")) {
        spinner.fail(chalk.red(`Execution Error: ${stderr}`));
    } else {
        spinner.succeed(chalk.green("Simulation Completed Successfully!"));
    }

    console.log("\n" + chalk.gray(stdout));

    if (opt === "3") {
      const resPath = path.join(
        __dirname,
        "..",
        "results",
        "protected_swap_result.json"
      );
      if (fs.existsSync(resPath)) {
        const data = JSON.parse(fs.readFileSync(resPath));
        printSummaryTable(data);
      }
    }

    console.log("");
    
    // Prompt to continue
    inquirer.prompt([{
        type: 'input',
        name: 'continue',
        message: 'Press Enter to return to the main menu...'
    }]).then(() => {
        process.stdout.write('\x1Bc');
        displayMenu();
    });
  });
};

function printSummaryTable(data) {
  const table = new Table({
    head: [chalk.cyan.bold("Metric"), chalk.cyan.bold("Value Evaluated")],
    colWidths: [30, 45],
    style: {
        head: [], // Disable default colors
        border: ['gray']
    }
  });

  const slippageVal = parseFloat(data.slippage_deviation);
  const slippageStr = slippageVal.toFixed(4) + "%";
  const slippageColored =
    slippageVal > 1.0 ? chalk.red(slippageStr) : chalk.green(slippageStr);

  const riskScore = parseFloat(data.normalized_risk_score);
  const riskStr = riskScore.toFixed(4);
  const riskColor = riskScore > 0.5 ? chalk.red(riskStr) : chalk.green(riskStr);

  let decisionColor = chalk.white;
  if (data.padgf_decision === "Block") decisionColor = chalk.red.bold;
  else if (data.padgf_decision === "Delay") decisionColor = chalk.yellow.bold;
  else if (data.padgf_decision === "Execute") decisionColor = chalk.green.bold;

  table.push(
    { "Reference Output": `${chalk.white(data.reference_output)} USDC` },
    { "Simulated Output": `${chalk.white(data.simulated_output)} USDC` },
    { "Slippage Deviation": slippageColored },
    { "Price Impact": `${parseFloat(data.price_impact).toFixed(4)}%` },
    { "Normalized Risk Score": riskColor },
    { "PADGF Decision": decisionColor(data.padgf_decision) },
    { "Execution Allowed": data.execution_allowed ? chalk.green("True") : chalk.red("False") }
  );

  if (data.execution_allowed) {
    table.push({ "Transaction Hash": chalk.gray(data.transaction_hash) });
  }

  console.log(chalk.cyan("\n*** PADGF EXECUTION SUMMARY ***"));
  console.log(table.toString());
}

displayMenu();
