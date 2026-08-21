// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// testnet feed. amoy has no inr/usd, so the deploy script uses this when ORACLE_FEED_ADDRESS is unset
contract MockAggregator {
  int256 public answer;
  uint8 public immutable decimals;
  uint256 public updatedAt;

  constructor(int256 initialAnswer, uint8 _decimals) {
    answer = initialAnswer;
    decimals = _decimals;
    updatedAt = block.timestamp;
  }

  function setAnswer(int256 newAnswer) external {
    answer = newAnswer;
    updatedAt = block.timestamp;
  }

  // lets tests fake an old round
  function setUpdatedAt(uint256 newUpdatedAt) external {
    updatedAt = newUpdatedAt;
  }

  function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
    return (0, answer, 0, updatedAt, 0);
  }
}