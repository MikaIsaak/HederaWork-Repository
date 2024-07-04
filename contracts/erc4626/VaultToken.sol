// SPDX-License-Identifier: GPL-3.0

pragma solidity 0.8.24;

import {ERC20} from "./ERC20.sol";

contract VaultToken is ERC20 {
    constructor() ERC20("VaultToken", "VLT", 8) {
        _mint(msg.sender, 1000 * 10 ** 8);
    }
}
