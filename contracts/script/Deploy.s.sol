// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/OracleProxy.sol";
import "../src/RemittanceEscrow.sol";

// usage: POLYGON_RELAYER_PRIVATE_KEY=0x... forge script Deploy.s.sol --rpc-url <url> --broadcast
contract DeployScript is Script {
  // same USDC on both Amoy and mainnet: 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359
  address constant USDC_MAINNET = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;

  function run() external {
    uint256 deployerKey = vm.envUint("POLYGON_RELAYER_PRIVATE_KEY");
    // Amoy INR/USD feed is the default; override for mainnet
    address feed = vm.envOr("ORACLE_FEED_ADDRESS", address(0xDA0F8Df6F5dB15b346f4B8D1156722027E194E60));
    address usdc = vm.envOr("USDC_ADDRESS", USDC_MAINNET);

    vm.startBroadcast(deployerKey);

    OracleProxy oracle = new OracleProxy(feed);
    RemittanceEscrow escrow = new RemittanceEscrow(usdc);
    // ZKVerifier removed — age check uses KYC-verified DOB from Aadhaar

    vm.stopBroadcast();

    console.log("OracleProxy:", address(oracle));
    console.log("RemittanceEscrow:", address(escrow));
    console.log("--- copy these into your .env ---");
    console.log(string.concat("ORACLE_PROXY_ADDRESS=", vm.toString(address(oracle))));
    console.log(string.concat("REMITTANCE_ESCROW_ADDRESS=", vm.toString(address(escrow))));
  }
}
