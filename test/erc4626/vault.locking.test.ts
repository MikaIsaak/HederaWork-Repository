import { anyValue, ethers, expect } from "../setup";
import {
    TokenTransfer,
    createFungibleToken,
    TokenBalance,
    createAccount,
    addToken,
    mintToken,
} from "../../scripts/utils";
import { getCorrectDepositNumber } from "./helper";
import { PrivateKey, Client, AccountId, TokenAssociateTransaction, AccountBalanceQuery } from "@hashgraph/sdk";
import hre from "hardhat";

const stakingTokenId = "0.0.4503147";

const sharesTokenAddress = "0x0000000000000000000000000000000000454eb8";
const sharesTokenId = "0.0.4542136";

const vaultAddress = "0x8aCAb306244d5c99AfbC74F3dc7509512EFE9bcA";
const vaultId = "0.0.4542135";

const reward1TokenAddress = "0x000000000000000000000000000000000044b66c";
const reward2TokenAddress = "0x000000000000000000000000000000000044b66e";
const reward1TokenId = "0.0.4503148";
const reward2TokenId = "0.0.4503150";

async function deployFixture() {
    const [owner] = await ethers.getSigners();

    console.log("Setting up the client for Hedera testnet...");
    let client = Client.forTestnet();

    console.log("Reading environment variables for operator private key and account ID...");
    const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
    const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");
    console.log("Operator Account ID: ", operatorAccountId.toString());

    client.setOperator(operatorAccountId, operatorPrKey);

    console.log("Reading ERC20 artifact...");
    const erc20 = await hre.artifacts.readArtifact("contracts/erc4626/ERC20.sol:ERC20");

    console.log("Associating shares token with operator account...");
    const sharesTokenAssociate = await new TokenAssociateTransaction()
        .setAccountId(operatorAccountId)
        .setTokenIds([sharesTokenId])
        .execute(client);

    console.log("Associating staking token with operator account...");
    const stakingTokenAssociate = await new TokenAssociateTransaction()
        .setAccountId(operatorAccountId)
        .setTokenIds([stakingTokenId])
        .execute(client);

    console.log("Associating reward tokens with operator account...");
    const rewardTokenAssociate = await new TokenAssociateTransaction()
        .setAccountId(operatorAccountId)
        .setTokenIds([reward1TokenId, reward2TokenId])
        .execute(client);

    console.log("Getting HederaVault contract instance...");
    const hederaVault = await ethers.getContractAt("HederaVault", vaultAddress);

    console.log("Getting reward token contract instances...");
    const rewardToken1 = await ethers.getContractAt(erc20.abi, reward1TokenAddress);
    const rewardToken2 = await ethers.getContractAt(erc20.abi, reward2TokenAddress);

    console.log("Getting staking token contract instance...");
    const stakingToken = await ethers.getContractAt(erc20.abi, await hederaVault.asset());

    console.log("Getting shares token contract instance...");
    const sharesToken = await ethers.getContractAt(erc20.abi, sharesTokenAddress);

    console.log("Fetching balance of reward token 1 for the operator...");
    const rewardToken1OperatorBalance = await TokenBalance(operatorAccountId, client);
    if (!rewardToken1OperatorBalance.tokens) {
        throw new Error("Failed to fetch balances for reward token 1.");
    }
    const reward1Balance = rewardToken1OperatorBalance.tokens.get(reward1TokenId);
    if (reward1Balance === undefined) {
        throw new Error(`Balance for token ${reward1TokenAddress} not found.`);
    }
    console.log("Reward token 1 balance: ", reward1Balance.toString());

    console.log("Fetching balance of reward token 2 for the operator...");
    const rewardToken2OperatorBalance = await TokenBalance(operatorAccountId, client);
    if (!rewardToken2OperatorBalance.tokens) {
        throw new Error("Failed to fetch balances for reward token 2.");
    }
    const reward2Balance = rewardToken2OperatorBalance.tokens.get(reward2TokenId);
    if (reward2Balance === undefined) {
        throw new Error(`Balance for token ${reward2TokenAddress} not found.`);
    }
    console.log("Reward token 2 balance: ", reward2Balance.toString());

    return {
        hederaVault,
        rewardToken1,
        rewardToken2,
        stakingToken,
        sharesToken,
        client,
        owner,
    };
}

describe("linear unlock", function () {
    it("Should unlock rewards linearly over time", async function () {
        const { hederaVault, owner, rewardToken1, rewardToken2, stakingToken } = await deployFixture();
        const amountToDeposit = 1000;
        const rewardAmount = 1000;

        console.log("Approving and depositing staking tokens...");
        await stakingToken.approve(hederaVault.target, amountToDeposit);
        console.log(await stakingToken.allowance(owner.getAddress(), hederaVault.getAddress()));
        await hederaVault.connect(owner).deposit(amountToDeposit, owner.address);

        console.log("Approving and adding reward tokens...");
        await rewardToken1.approve(hederaVault.target, rewardAmount);
        console.log(await rewardToken1.allowance(owner.getAddress(), hederaVault.getAddress()));
        await hederaVault.addReward(rewardToken1.target, rewardAmount, 300);

        console.log("Waiting for half the duration...");
        await new Promise((resolve) => setTimeout(resolve, 20 * 1000)); // Wait for 150 seconds

        console.log(await hederaVault.getUserReward(owner.address, rewardToken1.target));
        console.log(await hederaVault.getRewardTokens(), " token ");

        console.log("Balance before ", await rewardToken1.balanceOf(owner.address));

        await hederaVault.claimAllReward(0);

        console.log("balance after ", await rewardToken1.balanceOf(owner.address));
    });
});
