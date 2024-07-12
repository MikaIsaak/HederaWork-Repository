import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { createFungibleToken, TokenTransfer } from "../scripts/utils";
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import { HederaVault } from "../typechain-types";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("Deploying contract with account:", deployer.address, "at:", network.name);

    let client = Client.forTestnet();

    const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
    const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");

    client.setOperator(operatorAccountId, operatorPrKey);

    const rewardToken2 = await createFungibleToken(
        "Reward Token 2",
        "RT2",
        process.env.ACCOUNT_ID,
        operatorPrKey.publicKey,
        client,
        operatorPrKey,
    );

    const rewardToken2Addr = "0x" + rewardToken2!.toSolidityAddress();

    console.log("Reward token addrress 2 ", rewardToken2Addr);
    //REWARD TOKEN 2
    //hashscan.io/testnet/token/0.0.4503119

    const stakingTokenAddress = "0x" + stakingToken!.toSolidityAddress();
    console.log("Staking token address ", stakingTokenAddress);

    const feeConfig = {
        receiver: "0x091b4a7ea614a3bd536f9b62ad5641829a1b174f",
        token: "0x" + stakingToken!.toSolidityAddress(),
        minAmount: 0,
        feePercentage: 1000,
    };

    const pythFactory = await ethers.getContractFactory("MockPyth");
    const pythContract = await pythFactory.deploy();
    console.log("Pyth deployed with address: ", await pythContract.getAddress());
    //PYTH  https://hashscan.io/testnet/contract/0.0.4503120?p=1&k=1720181343.414378003

    const HederaVault = await ethers.getContractFactory("HederaVault");
    const hederaVault = await HederaVault.deploy(
        stakingTokenAddress,
        "TST",
        "TST",
        feeConfig,
        deployer.address,
        deployer.address,
        await pythContract.getAddress(),
        "0xACE99ADFd95015dDB33ef19DCE44fee613DB82C2",
        [rewardToken1Addr, rewardToken2Addr],
        [50000, 50000],
        [
            ethers.solidityPackedKeccak256(["address"], [rewardToken1Addr]),
            ethers.solidityPackedKeccak256(["address"], [rewardToken2Addr]),
        ],
        { from: deployer.address, gasLimit: 3000000, value: ethers.parseUnits("12", 18) },
    );
    console.log("Hash ", hederaVault.deploymentTransaction()?.hash);
    // console.log("Vault deployed with address: ", await hederaVault.getAddress());

    await hederaVault.waitForDeployment();

    console.log("Vault deployed with address: ", await hederaVault.getAddress());

    // const VaultFactory = await ethers.getContractFactory("VaultFactory");
    // const vaultFactory = await VaultFactory.deploy();
    // console.log("Hash ", vaultFactory.deploymentTransaction()?.hash);
    // await vaultFactory.waitForDeployment();

    // console.log("Vault Factory deployed with address: ", await vaultFactory.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
