// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

import "./AbstractModule.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract RequiresNFTModule is AbstractModule {
    // struct of required nfts
    struct RequiredNft {
        address nftAddress;
    }

    /// required nft addresses mapping
    mapping(address => RequiredNft) private _requiredNFTs;

    /**
     *  this event is emitted when a user NFT is required for transfer
     *  `_compliance` is the compliance address.
     *  `_nftAddress` is the required NFT address
     */
    event NFTRequired(address _compliance, address _nftAddress);

    /**
     *  this event is emitted when a user NFT is removed from requirements
     *  `_compliance` is the compliance address.
     */
    event NFTUnrequired(address _compliance);

    /**
     *  @dev add an required NFT for compliance.
     *  @param _nftAddress is the address of the nft
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `NFTRequired` event
     */
    function requireNFT(address _nftAddress) external onlyComplianceCall {
        require(_nftAddress != address(0), "Invalid Address");

        _requiredNFTs[msg.sender] = RequiredNft({
            nftAddress: _nftAddress
        });

        emit NFTRequired(msg.sender, _nftAddress);
    }

      /**
     *  @dev unregister an NFT for compliance.
     *  Only the owner of the Compliance smart contract can call this function
     *  emits an `NFTUnregister` event
     */
    function unrequireNFT() external onlyComplianceCall {
        _requiredNFTs[msg.sender] = RequiredNft({
            nftAddress: address(0)
        });

        emit NFTUnrequired(msg.sender);
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     *  no transfer action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleTransferAction(address _from, address _to, uint256 _value) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleMintAction}.
     *  no mint action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleMintAction(address _to, uint256 _value) external onlyComplianceCall {}

    /**
     *  @dev See {IModule-moduleBurnAction}.
     *  no burn action required in this module
     */
    // solhint-disable-next-line no-empty-blocks
    function moduleBurnAction(address _from, uint256 _value) external onlyComplianceCall {}

     /**
    *  @dev check if NFT is present in _userAddress wallet
    *  @param _compliance the Compliance smart contract to be checked
    *  @param _userAddress the user address to be checked
    */
    function isNFTPresent(address _compliance, address _userAddress) internal view returns (bool) {
        RequiredNft memory requiredNFT = _requiredNFTs[_compliance];
        
        if (requiredNFT.nftAddress == address(0)) return false;

        uint256 ownerOfToken = 
            IERC721(requiredNFT.nftAddress).balanceOf(_userAddress);

        return ownerOfToken > 0;
    }

    /**
     *  @dev See {IModule-moduleCheck}.
     */
    function moduleCheck(
        address _from,
        address _to,
        uint256 /*_value*/,
        address _compliance
    ) external view override returns (bool) {
        return isNFTPresent(_compliance, _to);
    }


    /**
     *  @dev See {IModule-canComplianceBind}.
     */
    function canComplianceBind(address /*_compliance*/) external view override returns (bool) {
        return true;
    }

    /**
     *  @dev See {IModule-isPlugAndPlay}.
     */
    function isPlugAndPlay() external pure override returns (bool) {
        return true;
    }

    /**
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "RequiresNFTModule";
    }
}
