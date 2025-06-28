// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/ccipSender.sol";

contract Deploy is Script {

        address router = 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59;
        address linkToken= 0x779877A7B0D9E8603169DdbD7836e478b4624789;
        address USDCToken = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; 
        
       function run() external {

        vm.startBroadcast();

        Sender senderContract = new Sender(
            router,
            linkToken,
            USDCToken
        );

        console.log("dStock contract deployed at:", address(senderContract));

        vm.stopBroadcast();
    }
}