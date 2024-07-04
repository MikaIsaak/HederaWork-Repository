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

  const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
  const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

  client.setOperator(
    operatorAccountId,
    operatorPrKey
  );

  const stakingToken = await createFungibleToken(
    "ERC4626 on Hedera",
    "HERC4626",
    process.env.ACCOUNT_ID,
    operatorPrKey.publicKey,
    client,
    operatorPrKey
  );

  const rewardToken = await createFungibleToken(
    "Reward Token 1",
    "RT1",
    process.env.ACCOUNT_ID,
    operatorPrKey.publicKey,
    client,
    operatorPrKey
  );

  console.log("Reward token addrress", rewardToken!.toSolidityAddress());

  const stakingTokenAddress = "0x" + stakingToken!.toSolidityAddress();

  const feeConfig = {
    receiver: "0x091b4a7ea614a3bd536f9b62ad5641829a1b174f",
    token: "0x" + stakingToken!.toSolidityAddress(),
    minAmount: 0,
    feePercentage: 1000,
  };

  const HederaVault = await ethers.getContractFactory("HederaVault");
  const hederaVault = await HederaVault.deploy(
    stakingTokenAddress,
    "TST",
    "TST",
    feeConfig,
    deployer.address,
    deployer.address,
    // deployer.address,
    { from: deployer.address, gasLimit: 3000000, value: ethers.parseUnits("12", 18) }
  );
  console.log("Hash ", hederaVault.deploymentTransaction()?.hash);
  await hederaVault.waitForDeployment();

  console.log("Vault deployed with address: ", await hederaVault.getAddress());

  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactory = await VaultFactory.deploy();
  console.log("Hash ", vaultFactory.deploymentTransaction()?.hash);
  await vaultFactory.waitForDeployment();

  console.log("Vault Factory deployed with address: ", await vaultFactory.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
