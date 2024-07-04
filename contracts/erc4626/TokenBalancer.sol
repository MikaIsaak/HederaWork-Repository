//SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

import {ISaucerSwap} from "./interfaces/ISaucerSwap.sol";

import "../common/safe-HTS/SafeHTS.sol";

/**
 * @title Token Balancer
 *
 * The contract that helps to maintain reward token balances.
 */
abstract contract TokenBalancer is AccessControl {
    mapping(address => uint256 allocationPercentage) internal targetPercentages;

    mapping(address => bytes32 priceId) public priceIds;

    mapping(address => address[]) public swapPaths;

    mapping(address => uint256) public tokenPrices;

    // Saucer Swap
    ISaucerSwap public saucerSwap;

    // Oracle
    IPyth public pyth;

    /**
     * @dev Initializes contract with passed parameters.
     *
     * @param _pyth The address of the Pyth oracle contract.
     * @param _saucerSwap The address of Saucer Swap contract.
     * @param tokens The reward tokens.
     * @param allocationPercentage The allocation percentages for rebalances.
     * @param _priceIds The Pyth price ids to fetch prices.
     */
    function __TokenBalancer_init(
        address _pyth,
        address _saucerSwap,
        address[] memory tokens,
        uint256[] memory allocationPercentage,
        bytes32[] memory _priceIds
    ) internal {
        saucerSwap = ISaucerSwap(_saucerSwap);
        pyth = IPyth(_pyth);

        address whbar = saucerSwap.WHBAR();

        uint256 tokensSize = tokens.length;
        for (uint256 i = 0; i < tokensSize; i++) {
            targetPercentages[tokens[i]] = allocationPercentage[i];
            priceIds[tokens[i]] = _priceIds[i];
            swapPaths[tokens[i]] = [whbar, tokens[i]];
            tokenPrices[tokens[i]] = _getPrice(tokens[i]);
        }
    }

    /**
     * @dev Gets token price and calculate one dollar in any token.
     *
     * @param token The token address.
     */
    function _getPrice(address token) public view returns (uint256 oneDollarInHbar) {
        PythStructs.Price memory price = pyth.getPrice(priceIds[token]);

        uint256 decimals = IERC20Metadata(token).decimals();

        uint256 hbarPrice8Decimals = (uint(uint64(price.price)) * (18 ** decimals)) /
            (18 ** uint8(uint32(-1 * price.expo)));
        oneDollarInHbar = ((18 ** decimals) * (18 ** decimals)) / hbarPrice8Decimals;
    }

    /**
     * @dev Updates price.
     *
     * @param pythPriceUpdate The pyth price update.
     */
    function update(bytes[] calldata pythPriceUpdate) public payable {
        uint updateFee = pyth.getUpdateFee(pythPriceUpdate);
        pyth.updatePriceFeeds{value: updateFee}(pythPriceUpdate);
    }

    /**
     * @dev Rebalances reward balances.
     */
    function rebalance(address[] calldata _rewardTokens) external {
        uint256 rewardTokensSize = _rewardTokens.length;
        uint256[] memory prices;
        for (uint256 i = 0; i < rewardTokensSize; i++) {
            prices[i] = tokenPrices[_rewardTokens[i]];
        }

        uint256[] memory swapAmounts = _rebalance(prices, _rewardTokens);

        _swapExtraRewardSupplyToTransitionToken(_rewardTokens);

        uint256 swapsCount = swapAmounts.length;
        for (uint256 i = 0; i < swapsCount; i++) {
            saucerSwap.swapExactETHForTokens(
                swapAmounts[i],
                swapPaths[_rewardTokens[i]],
                address(this),
                block.timestamp
            );
        }
    }

    /**
     * @dev Swaps extra reward balance to WHBAR token for future rebalance.
     *
     */
    function _swapExtraRewardSupplyToTransitionToken(address[] calldata _rewardTokens) public {
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            address token = _rewardTokens[i];
            uint256 tokenBalance = IERC20(token).balanceOf(address(this));
            uint256 tokenPrice = tokenPrices[token];
            uint256 totalValue = tokenBalance * tokenPrice;
            uint256 targetValue = (totalValue * targetPercentages[token]) / 10000;
            uint256 targetQuantity = targetValue / tokenPrice;

            if (tokenBalance > targetQuantity) {
                uint256 excessQuantity = tokenBalance - targetQuantity;

                // Approve token transfer to SaucerSwap
                IERC20(token).approve(address(saucerSwap), excessQuantity);

                // Perform the swap
                saucerSwap.swapExactTokensForETH(
                    excessQuantity,
                    0, // Accept any amount of ETH
                    swapPaths[token],
                    address(this),
                    block.timestamp
                );
            }
        }
    }

    function _rebalance(
        uint256[] memory _tokenPrices,
        address[] calldata _rewardTokens
    ) public view returns (uint256[] memory) {
        require(_tokenPrices.length == _rewardTokens.length, "Token prices array length mismatch");

        uint256 totalValue;
        uint256[] memory tokenBalances = new uint256[](_rewardTokens.length);

        // Calculate total value in the contract
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            tokenBalances[i] = IERC20(_rewardTokens[i]).balanceOf(address(this));
            totalValue += tokenBalances[i] * _tokenPrices[i];
        }

        // Array to store the amounts to swap
        uint256[] memory swapAmounts = new uint256[](_rewardTokens.length);

        // Calculate target values and swap amounts
        for (uint256 i = 0; i < _rewardTokens.length; i++) {
            uint256 targetValue = (totalValue * targetPercentages[_rewardTokens[i]]) / 10000;
            uint256 targetQuantity = targetValue / _tokenPrices[i];

            swapAmounts[i] = targetQuantity - tokenBalances[i];
        }

        return swapAmounts;
    }

    // Utility function to update target percentages
    function setTargetPercentage(address token, uint256 percentage) external {
        require(percentage < 10000, "Percentage exceeds 100%");
        require(token != address(0), "Invalid token address");
        targetPercentages[token] = percentage;
    }
}
