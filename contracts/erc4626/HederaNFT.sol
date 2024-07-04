// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract HederaNFT is ERC721, Ownable {
    constructor(address initialOwner) ERC721("KycTest", "KYT") Ownable(initialOwner) {}

    uint256 private _tokenIdCounter;

    function safeMint(address to) external {
        uint256 tokenId = _tokenIdCounter;
        _safeMint(to, tokenId);
        _tokenIdCounter++;
    }
}
