// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/ccipReceiver.sol";

contract Deploy is Script {

       address router= 0xf694e193200268f9a4868e4aa017a0118c9a8177;
       address USDCToken= 0x5425890298aed601595a70AB815c96711a31Bc65;
       address dStockContract = 0x1234567890abcdef1234567890abcdef12345678;

       function run() external {

        vm.startBroadcast();

        Receiver receiverContract = new Receiver(
            router,
            USDCToken,
            dStockContract
        );

        console.log("dStock contract deployed at:", address(receiverContract));

        vm.stopBroadcast();
    }
}