// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

interface AggregatorV3Interface {
  function decimals() external view returns (uint8);
  function latestRoundData()
    external view
    returns (uint80, int256, uint256, uint256, uint80);
}

interface IPyth {
  struct Price {
    int64 price;
    uint64 conf;
    int32 expo;
    uint32 publishTime;
  }
  function getUpdateFee(uint numUpdates) external view returns (uint fee);
  function getValidTimePeriod() external view returns (uint validTimePeriod);
  function parsePriceFeedUpdates(
    bytes[] calldata updateData,
    bytes32[] calldata feedIds,
    int minPublishTime,
    int maxPublishTime
  ) external payable returns (Price[] memory prices);
}

contract OracleProxy {
  AggregatorV3Interface public immutable feed;
  IPyth public immutable pyth;
  bytes32 public immutable pythFeedId;
  uint256 public immutable deviationThreshold;

  uint256 public lastPythPrice;
  uint256 public lastPythUpdatedAt;

  uint256 public constant CHAINLINK_STALE = 24 hours;
  uint256 public constant PYTH_STALE = 60 seconds;

  error StaleFeed(uint256 updatedAt);
  error FeedMismatch(uint256 chainlinkPrice, uint256 pythPrice);

  constructor(
    address feedAddress,
    address pythAddress,
    bytes32 _pythFeedId,
    uint256 _deviationThreshold
  ) {
    feed = AggregatorV3Interface(feedAddress);
    pyth = IPyth(pythAddress);
    pythFeedId = _pythFeedId;
    deviationThreshold = _deviationThreshold;
  }

  function updatePythPrice(bytes[] calldata updateData) external payable {
    uint256 fee = pyth.getUpdateFee(updateData.length);
    require(msg.value >= fee, "pyth: fee");

    int256 minTime = int256(block.timestamp) - 120;
    int256 maxTime = int256(block.timestamp) + 30;

    bytes32[] memory ids = new bytes32[](1);
    ids[0] = pythFeedId;

    IPyth.Price[] memory prices = pyth.parsePriceFeedUpdates(
      updateData, ids, minTime, maxTime
    );
    require(prices.length > 0, "pyth: no price");

    lastPythPrice = _normalizePythPrice(prices[0].price, prices[0].expo);
    lastPythUpdatedAt = block.timestamp;

    if (msg.value > fee) {
      (bool ok, ) = msg.sender.call{value: msg.value - fee}("");
      require(ok, "refund");
    }
  }

  function _normalizePythPrice(int64 rawPrice, int32 expo) internal pure returns (uint256) {
    if (expo == -8) return uint256(uint64(rawPrice));
    if (expo < -8) return uint256(uint64(rawPrice)) * 10 ** uint256(uint32(-8 - expo));
    return uint256(uint64(rawPrice)) / 10 ** uint256(uint32(expo + 8));
  }

  function _chainlinkRate() internal view returns (uint256 rate, uint8 dec, uint256 updatedAt) {
    (, int256 answer, , uint256 time, ) = feed.latestRoundData();
    if (answer <= 0 || block.timestamp > time + CHAINLINK_STALE) revert StaleFeed(time);
    dec = feed.decimals();
    rate = uint256(answer);
    updatedAt = time;
  }

  function _pythRate() internal view returns (uint256 rate) {
    if (lastPythPrice == 0 || block.timestamp > lastPythUpdatedAt + PYTH_STALE)
      revert StaleFeed(lastPythUpdatedAt);
    rate = lastPythPrice;
  }

  function getConversionRate() external view returns (uint256 rate, uint8 decimals) {
    bool hasCL = address(feed) != address(0);
    bool hasPy = address(pyth) != address(0) && pythFeedId != bytes32(0);

    if (hasCL && !hasPy) {
      (rate, decimals, ) = _chainlinkRate();
    } else if (!hasCL && hasPy) {
      rate = _pythRate();
      decimals = 8;
    } else {
      (uint256 clRate, uint8 clDec, ) = _chainlinkRate();
      uint256 pyRate = _pythRate();

      uint256 diff = clRate > pyRate ? clRate - pyRate : pyRate - clRate;
      uint256 avg = (clRate + pyRate) / 2;
      uint256 devBps = (diff * 10_000) / avg;

      if (devBps > deviationThreshold) revert FeedMismatch(clRate, pyRate);

      decimals = clDec;
      rate = (clRate + pyRate) / 2;
    }
  }
}
