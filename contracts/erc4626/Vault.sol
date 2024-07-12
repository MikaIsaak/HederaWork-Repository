// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
pragma abicoder v2;

import {ERC20} from "./ERC20.sol";
import {IERC4626} from "./interfaces/IERC4626.sol";
import {IHRC} from "../common/hedera/IHRC.sol";

import {FeeConfiguration} from "../common/FeeConfiguration.sol";
import {TokenBalancer} from "./TokenBalancer.sol";

import {FixedPointMathLib} from "./libraries/FixedPointMathLib.sol";
import {SafeTransferLib} from "./libraries/SafeTransferLib.sol";

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import "../common/safe-HTS/SafeHTS.sol";
import "../common/safe-HTS/IHederaTokenService.sol";

/**
 * @title Hedera Vault
 *
 * The contract which represents a custom Vault with Hedera HTS support.
 */
contract HederaVault is IERC4626, FeeConfiguration, TokenBalancer, Ownable, ReentrancyGuard {
    using SafeTransferLib for ERC20;
    using FixedPointMathLib for uint256;
    using Bits for uint256;

    // Staking token
    ERC20 public immutable asset;

    // Share token
    address public share;

    // Staked amount
    uint256 public assetTotalSupply;

    // Reward tokens
    address[] public rewardTokens;

    // Info by user
    mapping(address => UserInfo) public userContribution;

    // Reward info by user
    mapping(address => RewardsInfo) public tokensRewardInfo;

    // User Deposit struct
    struct UserDeposit {
        uint256 amount;
        uint256 timestamp;
        mapping(address => uint256) claimedRewards;
    }

    // User Info struct
    struct UserInfo {
        uint256 sharesAmount;
        bool exist;
        UserDeposit[] deposits;
    }

    // Reward Info struct
    struct RewardsInfo {
        uint256 vestingPeriod;
        RewardPeriod[] rewardPeriods;
    }

    // Reward Period struct
    struct RewardPeriod {
        uint256 startTime;
        uint256 endTime;
        uint256 rewardPerShare;
    }

    /**
     * @notice CreatedToken event.
     * @dev Emitted after contract initialization, when share token was deployed.
     *
     * @param createdToken The address of share token.
     */
    event CreatedToken(address indexed createdToken);

    /**
     * @notice RewardAdded event.
     * @dev Emitted when permissioned user adds reward to the Vault.
     *
     * @param rewardToken The address of reward token.
     * @param amount The added reward token amount.
     */
    event RewardAdded(address indexed rewardToken, uint256 amount);

    /**
     * @dev Initializes contract with passed parameters.
     *
     * @param _underlying The address of the asset token.
     * @param _name The share token name.
     * @param _symbol The share token symbol.
     * @param _feeConfig The fee configuration struct.
     * @param _vaultRewardController The Vault reward controller user.
     * @param _feeConfigController The fee config controller user.
     */
    constructor(
        ERC20 _underlying,
        string memory _name,
        string memory _symbol,
        FeeConfig memory _feeConfig,
        address _vaultRewardController,
        address _feeConfigController,
        address _pyth,
        address _saucerSwap,
        address[] memory _rewardTokens,
        uint256[] memory allocationPercentage,
        bytes32[] memory _priceIds
    ) payable ERC20(_name, _symbol, _underlying.decimals()) Ownable(msg.sender) {
        __FeeConfiguration_init(_feeConfig, _vaultRewardController, _feeConfigController);
        __TokenBalancer_init(_pyth, _saucerSwap, _rewardTokens, allocationPercentage, _priceIds);

        asset = _underlying;
        rewardTokens = _rewardTokens;

        _createTokenWithContractAsOwner(_name, _symbol, _underlying);
    }

    function _createTokenWithContractAsOwner(string memory _name, string memory _symbol, ERC20 _underlying) internal {
        SafeHTS.safeAssociateToken(address(_underlying), address(this));
        uint256 supplyKeyType;
        uint256 adminKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = address(this);

        IHederaTokenService.KeyValue memory adminKeyValue;
        adminKeyType = adminKeyType.setBit(0);
        adminKeyValue.delegatableContractId = address(this);

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);

        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);
        keys[1] = IHederaTokenService.TokenKey(adminKeyType, adminKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = address(this);
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = _name;
        newToken.symbol = _symbol;
        newToken.treasury = address(this);
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;
        share = SafeHTS.safeCreateFungibleToken(newToken, 0, _underlying.decimals());
        emit CreatedToken(share);
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     *
     * @param assets The amount of staking token to send.
     * @param receiver The shares receiver address.
     * @return shares The amount of shares to receive.
     */
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
        if ((shares = previewDeposit(assets)) == 0) revert ZeroShares(assets);

        asset.safeTransferFrom(msg.sender, address(this), assets);

        assetTotalSupply += assets;

        SafeHTS.safeMintToken(share, uint64(assets), new bytes[](0));

        SafeHTS.safeTransferToken(share, address(this), msg.sender, int64(uint64(assets)));

        emit Deposit(msg.sender, receiver, assets, shares);

        afterDeposit(assets);
    }

    /**
     * @dev Mints shares to receiver by depositing assets of underlying tokens.
     *
     * @param shares The amount of shares to send.
     * @param to The receiver of tokens.
     * @return amount The amount of tokens to receive.
     */
    function mint(uint256 shares, address to) public override nonReentrant returns (uint256 amount) {
        _mint(to, amount = previewMint(shares));

        assetTotalSupply += amount;

        emit Deposit(msg.sender, to, amount, shares);

        asset.safeTransferFrom(msg.sender, address(this), amount);

        afterDeposit(amount);
    }

    /**
     * @dev Burns shares from owner and sends assets of underlying tokens to receiver.
     *
     * @param amount The amount of assets.
     * @param receiver The staking token receiver.
     * @param from The owner of shares.
     * @return shares The amount of shares to burn.
     */
    function withdraw(
        uint256 amount,
        address receiver,
        address from
    ) public override nonReentrant returns (uint256 shares) {
        beforeWithdraw(amount);

        // _burn(from, shares = previewWithdraw(amount));
        assetTotalSupply -= amount;

        SafeHTS.safeTransferToken(share, msg.sender, address(this), int64(uint64(amount)));

        SafeHTS.safeBurnToken(share, uint64(amount), new int64[](0));

        asset.safeTransfer(receiver, amount);

        emit Withdraw(from, receiver, amount, shares);
    }

    /**
     * @dev Redeems shares for underlying assets.
     *
     * @param shares The amount of shares.
     * @param receiver The staking token receiver.
     * @param from The shares owner.
     * @return amount The amount of shares to burn.
     */
    function redeem(
        uint256 shares,
        address receiver,
        address from
    ) public override nonReentrant returns (uint256 amount) {
        require((amount = previewRedeem(shares)) != 0, "ZERO_ASSETS");

        amount = previewRedeem(shares);
        _burn(from, shares);
        assetTotalSupply -= amount;

        emit Withdraw(from, receiver, amount, shares);

        asset.safeTransfer(receiver, amount);
    }

    /*///////////////////////////////////////////////////////////////
                         INTERNAL HOOKS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Updates user state according to withdraw inputs.
     *
     * @param _amount The amount of shares.
     */
    function beforeWithdraw(uint256 _amount) internal {
        // claimAllReward(0);
        userContribution[msg.sender].sharesAmount -= _amount;
        assetTotalSupply -= _amount;
    }

    /**
     * @dev Updates user state after deposit and mint calls.
     *
     * This function updates the user's contribution information after they deposit tokens into the vault.
     * If it's the user's first deposit, it associates the reward tokens with the user.
     *
     * @param _amount The amount of tokens deposited.
     */
    function afterDeposit(uint256 _amount) internal {
        // Ensure the amount is not zero
        require(_amount != 0, "Vault: Amount can't be zero");

        // Check if the user is making their first deposit
        if (!userContribution[msg.sender].exist) {
            // For the first deposit, associate all reward tokens with the user
            uint256 rewardTokensSize = rewardTokens.length;
            for (uint256 i = 0; i < rewardTokensSize; i++) {
                address token = rewardTokens[i];
                IHRC(token).associate();
            }

            // Initialize the user's contribution with the deposited amount
            userContribution[msg.sender].sharesAmount = _amount;
            userContribution[msg.sender].exist = true;
        } else {
            // For subsequent deposits, add the deposited amount to the user's shares
            userContribution[msg.sender].sharesAmount += _amount;
        }

        // Create a new deposit entry for the user
        UserDeposit storage newDeposit = userContribution[msg.sender].deposits.push();
        newDeposit.amount = _amount;
        newDeposit.timestamp = block.timestamp;
    }

    /*///////////////////////////////////////////////////////////////
                        ACCOUNTING LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns reward tokens addresses.
     *
     * @return Reward tokens.
     */
    function getRewardTokens() public view returns (address[] memory) {
        return rewardTokens;
    }

    /**
     * @dev Returns amount of assets on the contract balance.
     *
     * @return Asset balance of this contract.
     */
    function totalAssets() public view override returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /**
     * @dev Calculates amount of assets that can be received for user share balance.
     *
     * @param user The user address.
     * @return The amount of underlying assets equivalent to the user's shares.
     */
    function assetsOf(address user) public view override returns (uint256) {
        return previewRedeem(balanceOf[user]);
    }

    /**
     * @dev Calculates amount of assets per share.
     *
     * @return The asset amount per share.
     */
    function assetsPerShare() public view override returns (uint256) {
        return previewRedeem(10 ** decimals);
    }

    /**
     * @dev Returns the maximum amount of underlying assets that can be deposited by user.
     *
     * @return The maximum assets amount that can be deposited.
     */
    function maxDeposit(address) public pure override returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Returns the maximum amount of shares that can be minted by user.
     *
     * @return The maximum shares amount that can be minted.
     */
    function maxMint(address) public pure override returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Calculates the maximum amount of assets that can be withdrawn by user.
     *
     * @param user The user address.
     * @return The maximum amount of assets that can be withdrawn.
     */
    function maxWithdraw(address user) public view override returns (uint256) {
        return assetsOf(user);
    }

    /**
     * @dev Returns the maximum number of shares that can be redeemed by user.
     *
     * @param user The user address.
     * @return The maximum number of shares that can be redeemed.
     */
    function maxRedeem(address user) public view override returns (uint256) {
        return balanceOf[user];
    }

    /**
     * @dev Calculates the amount of shares that will be minted for a given assets amount.
     *
     * @param amount The amount of underlying assets to deposit.
     * @return shares The estimated amount of shares that can be minted.
     */
    function previewDeposit(uint256 amount) public view override returns (uint256 shares) {
        uint256 supply = totalSupply;

        return supply == 0 ? amount : amount.mulDivDown(1, totalAssets());
    }

    /**
     * @dev Calculates the amount of underlying assets equivalent to a given shares amount.
     *
     * @param shares The shares amount to be minted.
     * @return amount The estimated assets amount.
     */
    function previewMint(uint256 shares) public view override returns (uint256 amount) {
        uint256 supply = totalSupply;

        return supply == 0 ? shares : shares.mulDivUp(totalAssets(), totalSupply);
    }

    /**
     * @dev Calculates the amount of shares that would be burned for a given assets amount.
     *
     * @param amount The amount of underlying assets to withdraw.
     * @return shares The estimated shares amount that can be burned.
     */
    function previewWithdraw(uint256 amount) public view override returns (uint256 shares) {
        uint256 supply = asset.balanceOf(address(this));

        return supply == 0 ? amount : amount.mulDivUp(supply, totalAssets());
    }

    /**
     * @dev Calculates the amount of underlying assets equivalent to a specific number of shares.
     *
     * @param shares The shares amount to redeem.
     * @return amount The estimated assets amount that can be redeemed.
     */
    function previewRedeem(uint256 shares) public view override returns (uint256 amount) {
        uint256 supply = totalSupply;

        return supply == 0 ? shares : shares.mulDivDown(totalAssets(), totalSupply);
    }

    /*///////////////////////////////////////////////////////////////
                        REWARDS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Adds reward to the Vault with a specified vesting period.
     *
     * This function is called by an authorized user to add rewards to the vault. It associates
     * the reward token with the contract, updates the reward periods, and transfers the reward tokens
     * to the vault.
     *
     * @param _token The reward token address.
     * @param _amount The amount of reward token to add.
     * @param _vestingPeriod The vesting period for the reward token.
     */
    function addReward(
        address _token,
        uint256 _amount,
        uint256 _vestingPeriod
    ) external payable onlyRole(VAULT_REWARD_CONTROLLER_ROLE) {
        // Ensure the token address is not zero, which would be invalid
        require(_token != address(0), "Vault: Token address can't be zero");

        // Ensure the amount is not zero, which would be invalid
        require(_amount != 0, "Vault: Amount can't be zero");

        // Ensure that there are tokens staked in the vault
        require(assetTotalSupply != 0, "Vault: No token staked yet");

        // Ensure the vesting period is not zero, which would be invalid
        require(_vestingPeriod != 0, "Vault: Vesting period can't be zero");

        // Ensure the reward token is not the same as the staking token or the share token
        require(_token != address(asset) && _token != share, "Vault: Reward and Staking tokens cannot be same");

        // Retrieve the reward info for the specified token
        RewardsInfo storage rewardInfo = tokensRewardInfo[_token];

        // Get the current time for reward period calculations
        uint256 currentTime = block.timestamp;

        // Check if the token is already in the reward tokens list
        bool tokenExists = false;
        uint256 rewardTokensSize = rewardTokens.length;
        for (uint256 i = 0; i < rewardTokensSize; i++) {
            if (rewardTokens[i] == _token) {
                tokenExists = true;
                break;
            }
        }

        // If the token is not already in the reward tokens list, add it
        if (!tokenExists) {
            rewardTokens.push(_token);

            // Set the vesting period for the new reward token
            rewardInfo.vestingPeriod = _vestingPeriod;

            // Associate the reward token with the vault
            SafeHTS.safeAssociateToken(_token, address(this));
        }

        // Add a new reward period for the token
        _addRewardPeriod(_token, _amount, currentTime);

        // Transfer the reward tokens from the sender to the vault
        ERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // Emit an event indicating that the reward has been added
        emit RewardAdded(_token, _amount);
    }

    /**
     * @dev Claims all pending reward tokens for the caller.
     *
     * This function allows a user to claim all their pending rewards for all reward tokens
     * starting from a specified position in the reward token list. It calculates the total
     * unlocked rewards for each token and transfers them to the caller.
     *
     * @param _startPosition The starting index in the reward token list from which to begin claiming rewards.
     * @return The index of the start position after the last claimed reward and the total number of reward tokens.
     */
    function claimAllReward(uint256 _startPosition) public payable returns (uint256, uint256) {
        // Get the total number of reward tokens available in the vault
        uint256 rewardTokensSize = rewardTokens.length;

        // Loop through the reward tokens starting from the specified position
        for (uint256 i = _startPosition; i < rewardTokensSize && i < _startPosition + 10; i++) {
            // Get the current reward token address
            address token = rewardTokens[i];
            // Calculate the total unlocked reward for the caller for this token
            uint256 totalUnlockedReward = getUserReward(token, msg.sender);

            // If there are no rewards to claim, skip to the next token
            if (totalUnlockedReward == 0) {
                continue;
            }

            // Transfer the unlocked reward tokens from the vault to the caller
            SafeHTS.safeTransferToken(token, address(this), msg.sender, int64(uint64(totalUnlockedReward)));
        }

        // Return the start position after the last claimed reward and the total number of reward tokens
        return (_startPosition, rewardTokensSize);
    }

    /**
     * @dev Returns user reward of a specific token.
     *
     * This function calculates the total unlocked reward for a given user and token.
     * It considers all the deposits made by the user and computes the unlocked rewards
     * based on the reward periods.
     *
     * @param _user The user address.
     * @param _token The reward token address.
     * @return unclaimedAmount The total amount of unclaimed rewards.
     */
    function getUserReward(address _user, address _token) public view returns (uint256 unclaimedAmount) {
        // Ensure the user address is not zero, which would be invalid
        require(_user != address(0), "Vault: User address can't be zero");

        // Ensure the token address is not zero, which would be invalid
        require(_token != address(0), "Vault: Token address can't be zero");

        // Retrieve the user's info including their deposits
        UserInfo storage userInfo = userContribution[_user];

        // Retrieve the reward info for the specified token
        RewardsInfo storage rewardInfo = tokensRewardInfo[_token];

        // Get the current time for reward calculations
        uint256 currentTime = block.timestamp;

        // Initialize total reward to zero
        uint256 totalReward = 0;

        // Get the number of deposits the user has made
        uint256 userDepositsLength = userInfo.deposits.length;

        // Get the number of reward periods for the token
        uint256 rewardPeriodsLength = rewardInfo.rewardPeriods.length;

        // Loop through each deposit the user has made
        for (uint256 i = 0; i < userDepositsLength; i++) {
            // Get the specific deposit information
            UserDeposit storage depositStr = userInfo.deposits[i];

            // Initialize unlocked reward for this deposit to zero
            uint256 unlockedReward = 0;

            // Calculate the end time for the vesting period of this deposit
            uint256 vestingEndTime = depositStr.timestamp + rewardInfo.vestingPeriod;

            // Loop through each reward period for the token
            for (uint256 j = 0; j < rewardPeriodsLength; j++) {
                // Get the specific reward period information
                RewardPeriod storage period = rewardInfo.rewardPeriods[j];

                // Skip this period if it starts after the vesting period ends
                if (period.startTime > vestingEndTime) {
                    continue;
                }

                // Calculate the elapsed time for the current period
                uint256 timeElapsed;
                if (currentTime > vestingEndTime) {
                    // If the current time is past the vesting end time, calculate time up to the vesting end time
                    timeElapsed = vestingEndTime - period.startTime;
                } else {
                    // Otherwise, calculate time up to the current time
                    timeElapsed = currentTime - period.startTime;
                }

                // If the reward period has ended, adjust the elapsed time accordingly
                if (period.endTime != 0 && currentTime > period.endTime) {
                    timeElapsed = period.endTime - period.startTime;
                }

                // Calculate the unlocked reward for this period and add it to the total unlocked reward
                unlockedReward += (depositStr.amount * period.rewardPerShare * timeElapsed) / rewardInfo.vestingPeriod;
            }

            // Subtract any previously claimed rewards for this deposit
            unlockedReward -= depositStr.claimedRewards[_token];

            // Add the unlocked reward for this deposit to the total reward
            totalReward += unlockedReward;
        }

        // Return the total unclaimed reward for the user
        return totalReward;
    }

    /**
     * @dev Returns all rewards for a user.
     *
     * @param _user The user address.
     * @return _rewards The calculated rewards.
     */
    function getAllRewards(address _user) public view returns (uint256[] memory) {
        require(_user != address(0), "Vault: User address can't be zero");
        uint256[] memory _rewards = new uint256[](rewardTokens.length);

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _rewards[i] = getUserReward(_user, rewardTokens[i]);
        }
        return _rewards;
    }

    /**
     * @dev Adds a new reward period for a given token.
     *
     * This function sets up a new reward period, ensuring that the previous period ends at the current time.
     *
     * @param _token The reward token address.
     * @param _amount The amount of reward token to add.
     * @param _currentTime The current block timestamp.
     */
    function _addRewardPeriod(address _token, uint256 _amount, uint256 _currentTime) internal {
        // Ensure the token address is not zero (an invalid address)
        require(_token != address(0), "Vault: Token address can't be zero");
        // Ensure the amount is not zero
        require(_amount != 0, "Vault: Amount can't be zero");
        // Ensure the current time is not zero
        require(_currentTime != 0, "Vault: Current time can't be zero");

        // Retrieve the rewards information for the specified token
        RewardsInfo storage rewardInfo = tokensRewardInfo[_token];
        // Get the number of existing reward periods for this token
        uint256 rewardPeriodsLength = rewardInfo.rewardPeriods.length;

        // If there are existing reward periods, update the end time of the last period
        if (rewardPeriodsLength > 0) {
            rewardInfo.rewardPeriods[rewardPeriodsLength - 1].endTime = _currentTime;
        }

        // Calculate the reward per share for the new period
        uint256 rewardPerShare = _amount / assetTotalSupply;

        // Add a new reward period starting at the current time with the calculated reward per share
        rewardInfo.rewardPeriods.push(
            RewardPeriod({startTime: _currentTime, endTime: 0, rewardPerShare: rewardPerShare})
        );
    }
}

library Bits {
    uint256 internal constant ONE = uint256(1);

    /**
     * @dev Sets the bit at the given 'index' in 'self' to '1'.
     *
     * @return Returns the modified value.
     */
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
