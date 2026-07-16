// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/OracleProxy.sol";
import "../src/RemittanceEscrow.sol";
import "../src/ZKVerifier.sol";

// ponytail: mainnet only. one-shot deploy + escrow approval.
contract DeployScript is Script {
    // Polygon mainnet
    address constant INR_USD_FEED = 0xDA0F8Df6F5dB15b346f4B8D1156722027E194E60;
    address constant USDC = 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359;

    function run() external {
        uint256 deployerKey = vm.envUint("POLYGON_RELAYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        OracleProxy oracle = new OracleProxy(INR_USD_FEED);
        RemittanceEscrow escrow = new RemittanceEscrow(USDC);
        // ponytail: zero country hash — set allowed country via admin after deploy
        ZKVerifier zk = new ZKVerifier(0);

        IERC20(USDC).approve(address(escrow), type(uint256).max);

        vm.stopBroadcast();

        console.log("OracleProxy:", address(oracle));
        console.log("RemittanceEscrow:", address(escrow));
        console.log("ZKVerifier:", address(zk));
        console.log("--- set these env vars ---");
        console.log(string.concat("ORACLE_PROXY_ADDRESS=", vm.toString(address(oracle))));
        console.log(string.concat("REMITTANCE_ESCROW_ADDRESS=", vm.toString(address(escrow))));
        console.log(string.concat("ZK_VERIFIER_ADDRESS=", vm.toString(address(zk))));
    }
}
