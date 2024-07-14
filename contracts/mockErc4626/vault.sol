// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma abicoder v2;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title Vault
 *
 * The contract which represents a custom Vault.
 *
 * /**
 * @title SafeMath
 * @dev Math operations with safety checks that throw on error
 */
library SafeMath {
    /**
     * @dev Multiplies two numbers, throws on overflow.
     */
    function mul(uint256 a, uint256 b) internal pure returns (uint256 c) {
        if (a == 0) {
            return 0;
        }
        c = a * b;
        assert(c / a == b);
        return c;
    }

    /**
     * @dev Integer division of two numbers, truncating the quotient.
     */
    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        // assert(b > 0); // Solidity automatically throws when dividing by 0
        // uint256 c = a / b;
        // assert(a == b * c + a % b); // There is no case in which this doesn't hold
        return a / b;
    }

    /**
     * @dev Subtracts two numbers, throws on overflow (i.e. if subtrahend is greater than minuend).
     */
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        assert(b <= a);
        return a - b;
    }

    /**
     * @dev Adds two numbers, throws on overflow.
     */
    function add(uint256 a, uint256 b) internal pure returns (uint256 c) {
        c = a + b;
        assert(c >= a);
        return c;
    }
}

contract Vault is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    // Staking token
    ERC20 public immutable asset;

    // Share token
    CustomERC20 public share;

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
    event Deposit(address indexed user, address indexed receiver, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, address indexed receiver, uint256 assets, uint256 shares);
    event RewardsClaimed(address indexed user, uint256 totalRewards, address indexed rewardToken);

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
     * @param _rewardTokens The reward tokens addresses.
     */
    constructor(
        ERC20 _underlying,
        string memory _name,
        string memory _symbol,
        address[] memory _rewardTokens
    ) payable Ownable(msg.sender) {
        asset = _underlying;
        share = new CustomERC20(_name, _symbol);
        rewardTokens = _rewardTokens;
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
    function deposit(uint256 assets, address receiver) public nonReentrant returns (uint256 shares) {
        if ((shares = previewDeposit(assets)) == 0) revert("ZeroShares");

        // asset.transferFrom(msg.sender, address(this), assets);
        asset.transferFrom(receiver, address(this), assets);

        assetTotalSupply += assets;

        share.mint(receiver, shares);

        emit Deposit(msg.sender, receiver, assets, shares);

        afterDeposit(assets);
    }

    /**
     * @dev Withdraws assets from the Vault.
     *
     * @param amount The amount of assets.
     * @param receiver The staking token receiver.
     * @param from The owner of shares.
     * @return shares The amount of shares to burn.
     */
    function withdraw(uint256 amount, address receiver, address from) public nonReentrant returns (uint256 shares) {
        beforeWithdraw(amount);

        shares = previewWithdraw(amount);
        share.burnFrom(from, shares);
        assetTotalSupply -= amount;

        asset.transfer(receiver, amount);

        emit Withdraw(from, receiver, amount, shares);
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
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    /**
     * @dev Calculates amount of assets that can be received for user share balance.
     *
     * @param user The user address.
     * @return The amount of underlying assets equivalent to the user's shares.
     */
    function assetsOf(address user) public view returns (uint256) {
        return previewRedeem(share.balanceOf(user));
    }

    /**
     * @dev Calculates amount of assets per share.
     *
     * @return The asset amount per share.
     */
    function assetsPerShare() public view returns (uint256) {
        return previewRedeem(10 ** share.decimals());
    }

    /**
     * @dev Returns the maximum amount of underlying assets that can be deposited by user.
     *
     * @return The maximum assets amount that can be deposited.
     */
    function maxDeposit(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Returns the maximum amount of shares that can be minted by user.
     *
     * @return The maximum shares amount that can be minted.
     */
    function maxMint(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Calculates the maximum amount of assets that can be withdrawn by user.
     *
     * @param user The user address.
     * @return The maximum amount of assets that can be withdrawn.
     */
    function maxWithdraw(address user) public view returns (uint256) {
        return assetsOf(user);
    }

    /**
     * @dev Returns the maximum number of shares that can be redeemed by user.
     *
     * @param user The user address.
     * @return The maximum number of shares that can be redeemed.
     */
    function maxRedeem(address user) public view returns (uint256) {
        return share.balanceOf(user);
    }

    /**
     * @dev Calculates the amount of shares that will be minted for a given assets amount.
     *
     * @param amount The amount of underlying assets to deposit.
     * @return shares The estimated amount of shares that can be minted.
     */
    function previewDeposit(uint256 amount) public view returns (uint256 shares) {
        uint256 supply = totalAssets();

        return supply == 0 ? amount : amount.mul(1e18).div(supply);
    }

    /**
     * @dev Calculates the amount of underlying assets equivalent to a given shares amount.
     *
     * @param shares The shares amount to be minted.
     * @return amount The estimated assets amount.
     */
    function previewMint(uint256 shares) public view returns (uint256 amount) {
        uint256 supply = totalAssets();

        return supply == 0 ? shares : shares.mul(supply).div(1e18);
    }

    /**
     * @dev Calculates the amount of shares that would be burned for a given assets amount.
     *
     * @param amount The amount of underlying assets to withdraw.
     * @return shares The estimated shares amount that can be burned.
     */
    function previewWithdraw(uint256 amount) public view returns (uint256 shares) {
        uint256 supply = totalAssets();

        return supply == 0 ? amount : amount.mul(1e18).div(supply);
    }

    /**
     * @dev Calculates the amount of underlying assets equivalent to a specific number of shares.
     *
     * @param shares The shares amount to redeem.
     * @return amount The estimated assets amount that can be redeemed.
     */
    function previewRedeem(uint256 shares) public view returns (uint256 amount) {
        uint256 supply = totalAssets();

        return supply == 0 ? shares : shares.mul(supply).div(1e18);
    }

    /*///////////////////////////////////////////////////////////////
                        REWARDS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Adds reward to the Vault with a specified vesting period.
     *
     * This function is called by an authorized user to add rewards to the vault. It updates the reward periods, and transfers the reward tokens
     * to the vault.
     *
     * @param _token The reward token address.
     * @param _amount The amount of reward token to add.
     * @param _vestingPeriod The vesting period for the reward token.
     */
    function addReward(address _token, uint256 _amount, uint256 _vestingPeriod) external onlyOwner {
        // Ensure the token address is not zero, which would be invalid
        require(_token != address(0), "Vault: Token address can't be zero");

        // Ensure the amount is not zero, which would be invalid
        require(_amount != 0, "Vault: Amount can't be zero");

        // Ensure that there are tokens staked in the vault
        require(assetTotalSupply != 0, "Vault: No token staked yet");

        // Ensure the vesting period is not zero, which would be invalid
        require(_vestingPeriod != 0, "Vault: Vesting period can't be zero");

        // Ensure the reward token is not the same as the staking token or the share token
        require(
            _token != address(asset) && _token != address(share),
            "Vault: Reward and Staking tokens cannot be same"
        );

        // Retrieve the reward info for the specified token
        RewardsInfo storage rewardInfo = tokensRewardInfo[_token];

        // Update the vesting period even if the token already exists
        rewardInfo.vestingPeriod = _vestingPeriod;

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
        }

        // Add a new reward period for the token
        _addRewardPeriod(_token, _amount, currentTime);

        // Transfer the reward tokens from the sender to the vault
        ERC20(_token).transferFrom(msg.sender, address(this), _amount);

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
    function claimAllReward(uint256 _startPosition) public returns (uint256, uint256) {
        // Get the total number of reward tokens available in the vault
        uint256 rewardTokensSize = rewardTokens.length;

        // Loop through the reward tokens starting from the specified position
        for (uint256 i = _startPosition; i < rewardTokensSize && i < _startPosition + 10; i++) {
            // Get the current reward token address
            address token = rewardTokens[i];
            // Calculate the total unlocked reward for the caller for this token
            uint256 totalUnlockedReward = getUserReward(msg.sender, token);

            // If there are no rewards to claim, skip to the next token
            if (totalUnlockedReward == 0) {
                continue;
            }

            // Transfer the unlocked reward tokens from the vault to the caller
            ERC20(token).transfer(msg.sender, totalUnlockedReward);
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

        // Ensure the vesting period is not zero to prevent division by zero
        require(rewardInfo.vestingPeriod > 0, "Vault: Vesting period can't be zero");

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
                // Calculate the elapsed time for the current period
                uint256 timeElapsed;

                // Skip this period if it starts after the vesting period ends
                if (period.startTime > vestingEndTime) {
                    continue;
                }

                if (period.endTime == 0) {
                    if (currentTime >= vestingEndTime) {
                        timeElapsed = vestingEndTime - period.startTime;
                    } else {
                        timeElapsed = currentTime - period.startTime;
                    }
                } else {
                    if (vestingEndTime >= period.endTime) {
                        timeElapsed = period.endTime - period.startTime;
                    } else {
                        timeElapsed = vestingEndTime - period.startTime;
                    }
                }

                // Calculate the proportion of rewards that have vested for this period
                unlockedReward += depositStr.amount.mul(period.rewardPerShare).mul(timeElapsed).div(
                    rewardInfo.vestingPeriod
                ); // Multiply by the reward per share for the period // Multiply by the time that has elapsed within this period // Divide by the total vesting period to get the pro-rata amount
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
        uint256 rewardPerShare = _amount.div(assetTotalSupply);
        require(rewardPerShare > 0, "Vault: rewardPerShare must be greater than zero");

        // Add a new reward period starting at the current time with the calculated reward per share
        rewardInfo.rewardPeriods.push(
            RewardPeriod({startTime: _currentTime, endTime: 0, rewardPerShare: rewardPerShare})
        );
    }
}

/**
 * @title CustomERC20
 * @dev Implementation of the ERC20 Token to be used as shares.
 */
contract CustomERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function burnFrom(address account, uint256 amount) public {
        _burn(account, amount);
    }
}
