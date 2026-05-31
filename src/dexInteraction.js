const hre = require("hardhat");

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function allowance(address owner, address spender) external view returns (uint256)"
];
const ROUTER_ABI = [
    "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
];

async function getTokens(wethAddress, usdcAddress, signer) {
    const weth = new hre.ethers.Contract(wethAddress, ERC20_ABI, signer);
    const usdc = new hre.ethers.Contract(usdcAddress, ERC20_ABI, signer);
    return { weth, usdc };
}

async function getRouter(routerAddress, signer) {
    return new hre.ethers.Contract(routerAddress, ROUTER_ABI, signer);
}

async function getQuote(router, amountIn, path) {
    try {
        const amountsOut = await router.getAmountsOut(amountIn, path);
        if (!amountsOut || amountsOut.length === 0) throw new Error("Empty quote returned from DEX.");
        return amountsOut[amountsOut.length - 1]; // last expected output
    } catch (err) {
        throw new Error(`Failed to get quote: ${err.message}`);
    }
}

async function executeSwap(router, weth, amountIn, expectedOutput, path, signer, slippagePercent = 1) {
    try {
        const routerAddress = await router.getAddress();
        
        // Ensure decimal issues don't crash our calculation
        if (amountIn <= 0n) throw new Error("Amount in must be greater than zero.");
        
        // Approve
        const approveTx = await weth.approve(routerAddress, amountIn, {
            maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
            maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei")
        });
        await approveTx.wait();

        const allowance = await weth.allowance(signer.address, routerAddress);
        if (allowance < amountIn) {
            throw new Error("Insufficient allowance after approve.");
        }
        
        const balance = await weth.balanceOf(signer.address);
        if (balance < amountIn) {
            throw new Error("Insufficient token balance for swap.");
        }

        // Execute
        // Apply slippage percent (e.g. 1% means outMin is 99% of expected output)
        const slippageBps = BigInt(Math.floor(slippagePercent * 100));
        const amountOutMin = (expectedOutput * (10000n - slippageBps)) / 10000n;

        const currentBlock = await hre.ethers.provider.getBlock("latest");
        const deadline = currentBlock.timestamp + 1200; // 20 minutes from now

        const swapTx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            signer.address,
            deadline,
            {
                gasLimit: 300000,
                maxFeePerGas: hre.ethers.parseUnits("100", "gwei"),
                maxPriorityFeePerGas: hre.ethers.parseUnits("2", "gwei")
            }
        );

        const receipt = await swapTx.wait();
        if (receipt.status === 0) {
            throw new Error("Swap transaction reverted on-chain.");
        }

        return receipt;
    } catch (err) {
        throw new Error(`Swap Execution Error: ${err.message}`);
    }
}

module.exports = { getTokens, getRouter, getQuote, executeSwap };
