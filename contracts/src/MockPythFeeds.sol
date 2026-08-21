// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./OracleProxy.sol";

contract MockPythFeeds is IPyth {
  mapping(bytes32 => Price) public prices;

  function getUpdateFee(uint) external pure override returns (uint) { return 0; }
  function getValidTimePeriod() external pure override returns (uint) { return 60; }

  function setPrice(bytes32 feedId, int64 rawPrice, int32 expo) external {
    prices[feedId] = Price({
      price: rawPrice,
      conf: 0,
      expo: expo,
      publishTime: uint32(block.timestamp)
    });
  }

  function setPublishTime(bytes32 feedId, uint32 oldTime) external {
    prices[feedId].publishTime = oldTime;
  }

  function parsePriceFeedUpdates(
    bytes[] calldata,
    bytes32[] calldata feedIds,
    int,
    int
  ) external payable override returns (Price[] memory result) {
    require(feedIds.length == 1, "mock: only 1 feed");
    Price memory p = prices[feedIds[0]];
    require(p.publishTime > 0, "mock: price not set");
    result = new Price[](1);
    result[0] = p;
  }
}
