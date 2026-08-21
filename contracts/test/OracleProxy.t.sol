// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {OracleProxy} from "../src/OracleProxy.sol";
import {MockAggregator} from "../src/MockAggregator.sol";
import {MockPythFeeds} from "../src/MockPythFeeds.sol";

bytes32 constant FEED_ID = keccak256("EUR/USD");

// ── single-source tests (chainlink only) ──

contract OracleProxyTest is Test {
  MockAggregator feed;
  OracleProxy proxy;

  function setUp() public {
    feed = new MockAggregator(120_000_000, 8);
    proxy = new OracleProxy(address(feed), address(0), bytes32(0), 0);
  }

  function testFreshFeedReturnsRate() public view {
    (uint256 rate, uint8 decimals) = proxy.getConversionRate();
    assertEq(rate, 120_000_000);
    assertEq(decimals, 8);
  }

  function testStaleFeedReverts() public {
    vm.warp(block.timestamp + 25 hours);
    feed.setUpdatedAt(block.timestamp - 25 hours);
    vm.expectRevert(
      abi.encodeWithSelector(OracleProxy.StaleFeed.selector, feed.updatedAt())
    );
    proxy.getConversionRate();
  }

  function testNegativeAnswerReverts() public {
    feed.setAnswer(-1);
    vm.expectRevert(
      abi.encodeWithSelector(OracleProxy.StaleFeed.selector, feed.updatedAt())
    );
    proxy.getConversionRate();
  }
}

// ── dual-source tests ──

contract DualSourceTest is Test {
  MockAggregator clFeed;
  MockPythFeeds pythFeed;
  OracleProxy proxy;

  function setUp() public {
    clFeed = new MockAggregator(1_100_000_000, 8);
    pythFeed = new MockPythFeeds();
    pythFeed.setPrice(FEED_ID, int64(1_100_000_000), int32(-8));

    proxy = new OracleProxy(
      address(clFeed),
      address(pythFeed),
      FEED_ID,
      500 // 5%
    );

    // seed pyth price into proxy storage
    bytes[] memory empty = new bytes[](0);
    proxy.updatePythPrice{value: 0}(empty);
  }

  function testMedianWhenFeedsAgree() public view {
    (uint256 rate, ) = proxy.getConversionRate();
    assertEq(rate, 1_100_000_000);
  }

  function testMedianWhenFeedsDifferSlightly() public {
    pythFeed.setPrice(FEED_ID, int64(1_105_000_000), int32(-8));
    bytes[] memory empty = new bytes[](0);
    proxy.updatePythPrice{value: 0}(empty);

    (uint256 rate, ) = proxy.getConversionRate();
    assertEq(rate, 1_102_500_000);
  }

  function testCircuitBreakerOnLargeDivergence() public {
    pythFeed.setPrice(FEED_ID, int64(1_200_000_000), int32(-8));
    bytes[] memory empty = new bytes[](0);
    proxy.updatePythPrice{value: 0}(empty);

    vm.expectRevert(
      abi.encodeWithSelector(
        OracleProxy.FeedMismatch.selector,
        uint256(1_100_000_000),
        uint256(1_200_000_000)
      )
    );
    proxy.getConversionRate();
  }

  function testFallbackToChainlinkWhenPythStale() public {
    vm.warp(block.timestamp + 61 seconds);
    vm.expectRevert(
      abi.encodeWithSelector(OracleProxy.StaleFeed.selector, 1)
    );
    proxy.getConversionRate();
  }

  function testSingleSourceChainlinkOnly() public {
    OracleProxy singleProxy = new OracleProxy(
      address(clFeed), address(0), bytes32(0), 0
    );
    (uint256 rate, ) = singleProxy.getConversionRate();
    assertEq(rate, 1_100_000_000);
  }
}
