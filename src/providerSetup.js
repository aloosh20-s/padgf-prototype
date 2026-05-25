const hre = require("hardhat");

async function setupProviderAndSigner(impersonatedAccount) {
    try {
        if (!process.env.MAINNET_RPC_URL) {
            throw new Error("Missing environment variable: MAINNET_RPC_URL. Please set it in the .env file.");
        }

        // Check fork connection by accessing the network
        const network = await hre.ethers.provider.getNetwork();
        if (!network) {
            throw new Error("Fork connection failure. Hardhat network is unreachable.");
        }

        // 1. Connect to Hardhat fork / Impersonate
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [impersonatedAccount],
        });

        // Provide some ETH to the account for gas
        await hre.network.provider.send("hardhat_setBalance", [
            impersonatedAccount,
            "0x8AC7230489E80000" // 10 ETH
        ]);

        const signer = await hre.ethers.getSigner(impersonatedAccount);
        if (!signer || !signer.address) {
            throw new Error("Failed to get valid impersonated signer or invalid whale impersonation.");
        }

        return signer;
    } catch (error) {
        throw new Error(`Provider Setup Error: ${error.message}`);
    }
}

module.exports = { setupProviderAndSigner };
