// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/dstock.sol";

contract Deploy is Script {

        string constant mintSourceCode = "./functions/sources/alpacaMintPrice.js";
        string constant redeemSourceCode = "./functions/sources/alpacaRedeemPrice.js";
        uint64 subId = 15619;
        uint64 secretVersion = 1751022661;
        uint8 secretSlot = 0; 
        
       function run() external {

        string memory mintSource = vm.readFile(mintSourceCode);
        string memory redeemSource = vm.readFile(redeemSourceCode);

        vm.startBroadcast();

        dstock dStockContract = new dstock(
            mintSource,
            redeemSource,
            subId,
            secretVersion,
            secretSlot
        );

        console.log("dStock contract deployed at:", address(dStockContract));

        vm.stopBroadcast();
    }
}