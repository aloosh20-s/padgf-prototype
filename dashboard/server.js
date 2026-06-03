const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;
const resultsDir = path.join(__dirname, '..', 'results');
const customDir = path.join(resultsDir, 'custom_runs');

const serveStaticFile = (res, filePath, contentType) => {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500);
            res.end(`Error loading ${filePath}`);
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
};

const runScript = (scriptName, res) => {
    const cmd = `npx hardhat run scripts/${scriptName} --network localhost`;
    const cwd = path.join(__dirname, '..');
    
    exec(cmd, { cwd }, (error, stdout, stderr) => {
        if (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message, stderr }));
            return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, stdout }));
    });
};

const parseBody = (req) => {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve({}); }
        });
    });
};

const server = http.createServer(async (req, res) => {
    // Static files
    if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        // Prevent directory traversal
        filePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
        
        let contentType = 'text/html';
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.css') contentType = 'text/css';
        else if (ext === '.js') contentType = 'application/javascript';
        else if (ext === '.png') contentType = 'image/png';
        else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
        
        serveStaticFile(res, path.join(__dirname, 'public', filePath), contentType);
        return;
    }

    // Official thesis results
    if (req.method === 'GET' && req.url === '/api/results') {
        const safeRead = (filename) => {
            try { return JSON.parse(fs.readFileSync(path.join(resultsDir, filename))); }
            catch { return null; }
        };
        const payload = {
            baseline: safeRead('baseline_result.json'),
            sandwich: safeRead('sandwich_attack_result.json'),
            protected: safeRead('protected_swap_result.json')
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));

    // Official phase runs (unchanged thesis logic)
    } else if (req.method === 'POST' && req.url === '/api/run/phase1') {
        runScript('baseline-swap.js', res);
    } else if (req.method === 'POST' && req.url === '/api/run/phase2') {
        runScript('sandwich-attack.js', res);
    } else if (req.method === 'POST' && req.url === '/api/run/phase3') {
        runScript('protected-swap.js', res);

    // Custom exploratory run
    } else if (req.method === 'POST' && req.url === '/api/run/custom') {
        const body = await parseBody(req);
        const amount = body.amount || '1.0';
        const slippage = body.slippage || '1';
        const scenario = body.scenario || 'baseline';

        const cwd = path.join(__dirname, '..');
        const envVars = `set CUSTOM_AMOUNT=${amount}&& set CUSTOM_SLIPPAGE=${slippage}&& set CUSTOM_SCENARIO=${scenario}&& `;
        const cmd = `${envVars}npx hardhat run scripts/custom-run.js --network localhost`;

        exec(cmd, { cwd, shell: 'cmd.exe' }, (error, stdout, stderr) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, stderr }));
                return;
            }
            // Read the custom result file
            let resultData = null;
            const fileMap = { baseline: 'custom_baseline.json', sandwich: 'custom_sandwich.json', protected: 'custom_protected.json' };
            try {
                resultData = JSON.parse(fs.readFileSync(path.join(customDir, fileMap[scenario])));
            } catch (e) { /* ignore */ }

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stdout, result: resultData }));
        });

    // User-Driven Evaluation - Evaluate Stage
    } else if (req.method === 'POST' && req.url === '/api/run/user-driven-evaluate') {
        const body = await parseBody(req);
        const amount = body.amount || '1.0';
        const slippage = body.slippage || '1';

        const cwd = path.join(__dirname, '..');
        const envVars = `set CUSTOM_AMOUNT=${amount}&& set CUSTOM_SLIPPAGE=${slippage}&& set DEMO_STAGE=EVALUATE&& `;
        const cmd = `${envVars}npx hardhat run scripts/user-driven-demo.js --network localhost`;

        exec(cmd, { cwd, shell: 'cmd.exe' }, (error, stdout, stderr) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, stderr }));
                return;
            }
            let resultData = null;
            try { resultData = JSON.parse(fs.readFileSync(path.join(customDir, 'user_driven_decision_result.json'))); } catch (e) { }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stdout, result: resultData }));
        });

    // User-Driven Evaluation - Execute Stage
    } else if (req.method === 'POST' && req.url === '/api/run/user-driven-execute') {
        const body = await parseBody(req);
        const amount = body.amount || '1.0';
        const slippage = body.slippage || '1';
        const userAction = body.userAction || 'auto_executed'; // auto_executed, cancelled, continued_despite_warning
        const executionType = body.executionType || 'normal'; // normal, sandwich, none
        const gasSpeed = body.gasSpeed || 'standard';

        const cwd = path.join(__dirname, '..');
        const envVars = `set CUSTOM_AMOUNT=${amount}&& set CUSTOM_SLIPPAGE=${slippage}&& set DEMO_STAGE=EXECUTE&& set DEMO_USER_ACTION=${userAction}&& set DEMO_EXEC_TYPE=${executionType}&& set DEMO_GAS_SPEED=${gasSpeed}&& `;
        const cmd = `${envVars}npx hardhat run scripts/user-driven-demo.js --network localhost`;

        exec(cmd, { cwd, shell: 'cmd.exe' }, (error, stdout, stderr) => {
            if (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message, stderr }));
                return;
            }
            let resultData = null;
            try { resultData = JSON.parse(fs.readFileSync(path.join(customDir, 'user_driven_decision_result.json'))); } catch (e) { }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, stdout, result: resultData }));
        });

    // Fetch live gas prices from the Hardhat node
    } else if (req.method === 'GET' && req.url === '/api/gas-prices') {
        const cwd = path.join(__dirname, '..');
        // Use a small inline script to read fee data from the provider
        const inlineScript = `
            const hre = require("hardhat");
            async function main() {
                const feeData = await hre.ethers.provider.getFeeData();
                const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || hre.ethers.parseUnits("50", "gwei");
                const baseGwei = parseFloat(hre.ethers.formatUnits(gasPrice, "gwei"));
                const swapGasUnits = 150000;
                const tiers = {
                    standard: { gwei: baseGwei.toFixed(2), multiplier: "1.0x", totalWei: gasPrice * BigInt(swapGasUnits), totalEth: parseFloat(hre.ethers.formatEther(gasPrice * BigInt(swapGasUnits))).toFixed(6) },
                    fast: { gwei: (baseGwei * 1.5).toFixed(2), multiplier: "1.5x", totalWei: ((gasPrice * 150n) / 100n) * BigInt(swapGasUnits), totalEth: parseFloat(hre.ethers.formatEther(((gasPrice * 150n) / 100n) * BigInt(swapGasUnits))).toFixed(6) },
                    instant: { gwei: (baseGwei * 2.5).toFixed(2), multiplier: "2.5x", totalWei: ((gasPrice * 250n) / 100n) * BigInt(swapGasUnits), totalEth: parseFloat(hre.ethers.formatEther(((gasPrice * 250n) / 100n) * BigInt(swapGasUnits))).toFixed(6) }
                };
                // BigInt serialization
                const output = {
                    standard: { gwei: tiers.standard.gwei, multiplier: tiers.standard.multiplier, totalEth: tiers.standard.totalEth },
                    fast: { gwei: tiers.fast.gwei, multiplier: tiers.fast.multiplier, totalEth: tiers.fast.totalEth },
                    instant: { gwei: tiers.instant.gwei, multiplier: tiers.instant.multiplier, totalEth: tiers.instant.totalEth },
                    baseGwei: baseGwei.toFixed(2),
                    swapGasUnits
                };
                console.log(JSON.stringify(output));
            }
            main();
        `;
        const tmpFile = path.join(cwd, 'scripts', '_tmp_gas_check.js');
        fs.writeFileSync(tmpFile, inlineScript);
        const cmd = `npx hardhat run scripts/_tmp_gas_check.js --network localhost`;
        exec(cmd, { cwd }, (error, stdout, stderr) => {
            try { fs.unlinkSync(tmpFile); } catch(e) {}
            if (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: error.message }));
                return;
            }
            try {
                // Extract the JSON line from stdout (skip Hardhat compilation noise)
                const lines = stdout.trim().split('\n');
                const jsonLine = lines.find(l => l.startsWith('{'));
                const parsed = JSON.parse(jsonLine);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(parsed));
            } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                // Fallback with default values
                res.end(JSON.stringify({
                    standard: { gwei: "1.00", multiplier: "1.0x", totalEth: "0.000150" },
                    fast: { gwei: "1.50", multiplier: "1.5x", totalEth: "0.000225" },
                    instant: { gwei: "2.50", multiplier: "2.5x", totalEth: "0.000375" },
                    baseGwei: "1.00",
                    swapGasUnits: 150000
                }));
            }
        });

    // Read latest custom results
    } else if (req.method === 'GET' && req.url === '/api/custom-results') {
        const safeRead = (filename) => {
            try { return JSON.parse(fs.readFileSync(path.join(customDir, filename))); }
            catch { return null; }
        };
        const payload = {
            baseline: safeRead('custom_baseline.json'),
            sandwich: safeRead('custom_sandwich.json'),
            protected: safeRead('custom_protected.json')
        };
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));

    // Download files
    } else if (req.method === 'GET' && req.url.startsWith('/api/download/')) {
        const filename = req.url.replace('/api/download/', '');
        // Prevent directory traversal
        const safeName = path.basename(filename);
        const filePath = path.join(resultsDir, safeName);
        
        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404);
                res.end("File not found");
            } else {
                const isCSV = safeName.endsWith('.csv');
                res.writeHead(200, {
                    'Content-Type': isCSV ? 'text/csv' : 'application/json',
                    'Content-Disposition': `attachment; filename="${safeName}"`
                });
                res.end(data);
            }
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`PADGF Supervisor Dashboard Server Initialized`);
    console.log(`===============================================`);
    console.log(`Access interface at: http://localhost:${PORT}`);
    console.log(`Note: 'npx hardhat node' must be running in another terminal.`);
    console.log(`Press Ctrl+C to stop.`);
});
