// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// real AggregatorV3Interface is fat, this is all we need
interface AggregatorV3Interface {
  function decimals() external view returns (uint8);
  function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

contract OracleProxy {
  AggregatorV3Interface public immutable feed;

  // Amoy (testnet): 0xDA0F8Df6F5dB15b346f4B8D1156722027E194E60
  constructor(address feedAddress) {
    feed = AggregatorV3Interface(feedAddress);
  }

  function getConversionRate() external view returns (uint256 rate, uint8 decimals) {
    (, int256 answer, , , ) = feed.latestRoundData();
    decimals = feed.decimals();
    rate = uint256(answer);
  }
}
