const hre = require("hardhat");

async function main() {
    try {
        const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        const ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
        const IMPERSONATED_ACCOUNT = "0x28C6c06298d514Db089934071355E5743bf21d60";

        // 1. Connect to Hardhat fork / Impersonate
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [IMPERSONATED_ACCOUNT],
        });

        // Provide some ETH to the account for gas
        await hre.network.provider.send("hardhat_setBalance", [
            IMPERSONATED_ACCOUNT,
            "0x8AC7230489E80000" // 10 ETH
        ]);

        const signer = await hre.ethers.getSigner(IMPERSONATED_ACCOUNT);

        // ABIs
        const ERC20_ABI = [
            "function approve(address spender, uint256 amount) external returns (bool)",
            "function balanceOf(address account) external view returns (uint256)"
        ];
        const ROUTER_ABI = [
            "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)",
            "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"
        ];

        const weth = new hre.ethers.Contract(WETH_ADDRESS, ERC20_ABI, signer);
        const usdc = new hre.ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
        const router = new hre.ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);

        const amountIn = hre.ethers.parseUnits("1.0", 18);
        const path = [WETH_ADDRESS, USDC_ADDRESS];

        // Quote
        const amountsOut = await router.getAmountsOut(amountIn, path);
        const expectedOutput = amountsOut[1];

        // Approve
        const approveTx = await weth.approve(ROUTER_ADDRESS, amountIn);
        await approveTx.wait();

        const usdcBalanceBefore = await usdc.balanceOf(IMPERSONATED_ACCOUNT);

        // Execute
        // 99% of expected output to allow for 1% slippage
        const amountOutMin = (expectedOutput * 99n) / 100n;

        const currentBlock = await hre.ethers.provider.getBlock("latest");
        const deadline = currentBlock.timestamp + 1200; // 20 minutes from current block

        const swapTx = await router.swapExactTokensForTokens(
            amountIn,
            amountOutMin,
            path,
            signer.address,
            deadline
        );

        const receipt = await swapTx.wait();

        const usdcBalanceAfter = await usdc.balanceOf(IMPERSONATED_ACCOUNT);
        const actualOutput = usdcBalanceAfter - usdcBalanceBefore;

        const result = {
            phase: "1_baseline",
            status: "success",
            input_token: "WETH",
            input_amount: amountIn.toString(),
            output_token: "USDC",
            expected_output: expectedOutput.toString(),
            actual_output: actualOutput.toString(),
            transaction_hash: receipt.hash,
            gas_used: receipt.gasUsed.toString()
        };

        console.log(JSON.stringify(result, null, 2));

    } catch (error) {
        console.error(JSON.stringify({
            phase: "1_baseline",
            status: "error",
            error: error.message
        }, null, 2));
        process.exit(1);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
