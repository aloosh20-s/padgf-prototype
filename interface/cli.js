const readline = require('readline');
const { exec } = require('child_process');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("PADGF Phase 1 Interface");
console.log("1 → Execute baseline swap");

rl.question("Select an option: ", (answer) => {
    if (answer.trim() === '1') {
        console.log("Executing baseline swap...");
        
        // Execute the hardhat script against the local node
        // We ensure we use the local node v20 in PATH if necessary, or just rely on npx
        const command = "npx hardhat run scripts/baseline-swap.js --network localhost";
        
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Stderr: ${stderr}`);
            }
            console.log(stdout);
            rl.close();
        });
    } else {
        console.log("Invalid option.");
        rl.close();
    }
});
