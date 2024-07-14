// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "lib/forge-std/src/Script.sol";
import "contracts/mockErc4626/asset.sol";
import "contracts/mockErc4626/rewardToken.sol";
import "contracts/mockErc4626/vault.sol";
import "lib/forge-std/src/console.sol";

contract DeployAndSetup is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // Deploy AssetToken
        AssetToken assetToken = new AssetToken();
        assetToken.mint(deployer, 1000 ether); // Mint 1000 tokens to the deployer

        // Deploy RewardToken1
        RewardToken1 rewardToken = new RewardToken1();
        rewardToken.mint(deployer, 1000 ether); // Mint 1000 tokens to the deployer

        // Prepare arguments for Vault deployment
        address[] memory rewardTokens = new address[](1);
        rewardTokens[0] = address(rewardToken);

        // Deploy Vault
        Vault vault = new Vault(ERC20(address(assetToken)), "VaultShare", "VSHR", rewardTokens);

        // Approve Vault to spend tokens
        assetToken.approve(address(vault), 1000 ether);
        rewardToken.approve(address(vault), 1000 ether);

        console.log("AssetToken address:", address(assetToken));
        console.log("RewardToken1 address:", address(rewardToken));
        console.log("Vault address:", address(vault));
        console.log("Deployer address:", deployer);
        console.log("Deployer balance of AssetToken:", assetToken.balanceOf(deployer));
        console.log("Deployer balance of RewardToken1:", rewardToken.balanceOf(deployer));

        // Deposit 1000 AssetTokens into the Vault
        vault.deposit(1000 ether, deployer);

        // Add Reward to the Vault
        vault.addReward(address(rewardToken), 1000 ether, 30);
        console.log("Deployer balance of RewardToken1:", rewardToken.balanceOf(deployer));

        vm.warp(block.timestamp + 30 days);

        console.log("Reward is ", vault.getUserReward(deployer, address(rewardToken)));
        vault.claimAllReward(0);
        console.log("Deployer balance of RewardToken1:", rewardToken.balanceOf(deployer));

        vm.stopBroadcast();
    }
}
