// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

// ponytail: minimal Chainlink feed interface, no OZ dependency needed
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);
}

contract OracleProxy {
    AggregatorV3Interface public immutable feed;

    // Polygon Amoy: 0x3C2f68B3... , mainnet: 0x3C2f68B3...
    constructor(address feedAddress) {
        feed = AggregatorV3Interface(feedAddress);
    }

    function getConversionRate() external view returns (uint256 rate, uint8 decimals) {
        (, int256 answer, , , ) = feed.latestRoundData();
        decimals = feed.decimals();
        rate = uint256(answer);
    }
}
