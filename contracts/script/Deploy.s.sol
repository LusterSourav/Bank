// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../src/OracleProxy.sol";
import "../src/RemittanceEscrow.sol";
import "../src/MockAggregator.sol";
import "../src/MockPythFeeds.sol";

contract MockERC20 {
  string public name;
  string public symbol;
  uint8 public constant decimals = 6;
  uint256 public totalSupply;
  mapping(address => uint256) public balanceOf;
  mapping(address => mapping(address => uint256)) public allowance;

  constructor(string memory _name, string memory _symbol) {
    name = _name;
    symbol = _symbol;
    totalSupply = 1_000_000 * 10**6;
    balanceOf[msg.sender] = totalSupply;
  }

  function transfer(address to, uint256 amount) external returns (bool) {
    balanceOf[msg.sender] -= amount;
    balanceOf[to] += amount;
    return true;
  }

  function approve(address spender, uint256 amount) external returns (bool) {
    allowance[msg.sender][spender] = amount;
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) external returns (bool) {
    allowance[from][msg.sender] -= amount;
    balanceOf[from] -= amount;
    balanceOf[to] += amount;
    return true;
  }
}

// usage: POLYGON_RELAYER_PRIVATE_KEY=0x... forge script Deploy.s.sol --rpc-url <url> --broadcast
// optional envs: ORACLE_FEED_ADDRESS, PYTH_PRICE_ADDRESS, PYTH_FEED_ID, ORACLE_DEVIATION_BPS
contract DeployScript is Script {
  function run() external {
    uint256 deployerKey = vm.envUint("POLYGON_RELAYER_PRIVATE_KEY");

    address feed = vm.envOr("ORACLE_FEED_ADDRESS", address(0));
    address pyth = vm.envOr("PYTH_PRICE_ADDRESS", address(0));
    bytes32 feedId = vm.envOr("PYTH_FEED_ID", bytes32(0));
    uint256 devBps = vm.envOr("ORACLE_DEVIATION_BPS", uint256(500));

    address mockFeed;
    address mockPyth;
    OracleProxy oracle;

    vm.startBroadcast(deployerKey);

    // ── feed setup ──
    if (feed == address(0)) {
      MockAggregator mock = new MockAggregator(vm.envOr("INR_USD_ANSWER", int256(120_000_000)), 8);
      mockFeed = address(mock);
      feed = mockFeed;
    }

    // ── pyth setup (mock when no real address) ──
    if (pyth == address(0)) {
      MockPythFeeds mp = new MockPythFeeds();
      // seed mock pyth with chainlink price so tests / deploy don't blow up
      int256 clAnswer = MockAggregator(feed).answer();
      bytes32 eurUsd = keccak256("EUR/USD");
      mp.setPrice(eurUsd, int64(clAnswer), int32(-8));
      mockPyth = address(mp);
      pyth = mockPyth;
      feedId = eurUsd;
    }

    oracle = new OracleProxy(feed, pyth, feedId, devBps);

    // ── tokens ──
    address usdc = _token("USDC_ADDRESS", "Mock USDC", "mUSDC");
    address usdt = _token("USDT_ADDRESS", "Mock USDT", "mUSDT");
    address eurc = _token("EURC_ADDRESS", "Mock EURC", "mEURC");

    // ── escrows ──
    RemittanceEscrow escrow = new RemittanceEscrow(usdc);
    RemittanceEscrow usdtEscrow = new RemittanceEscrow(usdt);
    RemittanceEscrow eurcEscrow = new RemittanceEscrow(eurc);

    vm.stopBroadcast();

    console.log("OracleProxy:", address(oracle));
    console.log("RemittanceEscrow:", address(escrow));
    console.log("--- copy these into your .env ---");
    console.log(string.concat("ORACLE_PROXY_ADDRESS=", vm.toString(address(oracle))));
    console.log(string.concat("REMITTANCE_ESCROW_ADDRESS=", vm.toString(address(escrow))));
    console.log(string.concat("USDC_ADDRESS=", vm.toString(usdc)));
    console.log(string.concat("USDT_ADDRESS=", vm.toString(usdt)));
    console.log(string.concat("EURC_ADDRESS=", vm.toString(eurc)));
    console.log(string.concat("USDT_ESCROW_ADDRESS=", vm.toString(address(usdtEscrow))));
    console.log(string.concat("EURC_ESCROW_ADDRESS=", vm.toString(address(eurcEscrow))));
    console.log(string.concat("ORACLE_DEVIATION_BPS=", vm.toString(devBps)));
    if (mockFeed != address(0)) {
      console.log(string.concat("MOCK_INR_USD_FEED=", vm.toString(mockFeed)));
    }
    if (mockPyth != address(0)) {
      console.log(string.concat("MOCK_PYTH_FEED=", vm.toString(mockPyth)));
    }
  }

  // deploy or read a token from env
  function _token(string memory env, string memory name, string memory symbol) internal returns (address token) {
    string memory addr = vm.envOr(env, string(""));
    if (bytes(addr).length == 0) {
      token = address(new MockERC20(name, symbol));
      console.log(string.concat("Mock ", symbol, ":"), token);
    } else {
      token = vm.parseAddress(addr);
    }
  }
}
