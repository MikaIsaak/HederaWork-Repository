import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { createFungibleToken, TokenTransfer } from "../scripts/utils";
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import { HederaVault } from "../typechain-types";
import { ZeroAddress } from "ethers";

dotenv.config();

const deployedOracle = "0xC48277F42d738A06B8bD6a61700aF35018Cf5AEc";
const rw1Id = ethers.keccak256(ethers.toUtf8Bytes("RT1"));
const rw2Id = ethers.keccak256(ethers.toUtf8Bytes("RT2"));

async function main() {
    const [deployer] = await ethers.getSigners();
    const network = await ethers.provider.getNetwork();

    console.log("Deploying contract with account:", deployer.address, "at:", network.name);

    let client = Client.forTestnet();

    const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
    const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");

    client.setOperator(operatorAccountId, operatorPrKey);

    // const blockNumBefore = await ethers.provider.getBlockNumber();
    // const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    // const timestampBefore = blockBefore!.timestamp;

    // const stakingToken = await createFungibleToken(
    //   "ERC4626 on Hedera",
    //   "HERC4626",
    //   process.env.ACCOUNT_ID,
    //   operatorPrKey.publicKey,
    //   client,
    //   operatorPrKey
    // );

    // const rewardToken = await createFungibleToken(
    //   "Reward Token 1",
    //   "RT1",
    //   process.env.ACCOUNT_ID,
    //   operatorPrKey.publicKey,
    //   client,
    //   operatorPrKey
    // );

    // console.log("Reward token addrress", rewardToken!.toSolidityAddress());

    // const stakingTokenAddress = "0x" + stakingToken!.toSolidityAddress();

    const feeConfig = {
        receiver: ZeroAddress,
        token: ZeroAddress,
        feePercentage: 0,
    };

    // const oracle = await ethers.getContractAt("MockOracle", deployedOracle);
    // const tx = await oracle.setPrice(rw2Id, 10000000000, 10, -8, timestampBefore);
    // console.log(tx.hash);
    // console.log(await oracle.getPrice(rw1Id));

    // const MockOracle = await ethers.getContractFactory("MockOracle");
    //   const mockOracle = await MockOracle.deploy(
    //   );
    // console.log("Hash ", mockOracle.deploymentTransaction()?.hash);
    // await mockOracle.waitForDeployment();

    // console.log("Mock Oracle deployed with address: ", await mockOracle.getAddress());

    // const feeConfig = {
    //   receiver: "0x091b4a7ea614a3bd536f9b62ad5641829a1b174f",
    //   token: "0x" + stakingToken!.toSolidityAddress(),
    //   feePercentage: 1000,
    // };

    const HederaVault = await ethers.getContractFactory("HederaVault");
    const hederaVault = await HederaVault.deploy(
        "0x000000000000000000000000000000000044b66b",
        "TST",
        "TST",
        feeConfig,
        deployer.address,
        deployer.address,
        deployedOracle,
        "0xACE99ADFd95015dDB33ef19DCE44fee613DB82C2",
        ["0x000000000000000000000000000000000044b66c", "0x000000000000000000000000000000000044b66e"],
        [50000, 50000],
        [rw1Id, rw2Id],
        { from: deployer.address, gasLimit: 3000000, value: ethers.parseUnits("16", 18) },
    );
    console.log("Hash ", hederaVault.deploymentTransaction()?.hash);
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
