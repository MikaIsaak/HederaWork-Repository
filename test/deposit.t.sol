pragma solidity 0.8.10;

import "lib/forge-std/src/Test.sol";

contract ContractBTest is Test {
    uint256 testNumber;

    function setUp() public {
        testNumber = 42;
    }

    function Deposit() public {
        assertEq(testNumber, 42);
    }
}
