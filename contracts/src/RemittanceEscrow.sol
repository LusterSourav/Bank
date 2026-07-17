// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// CLTV-style timelock escrow. relayer deposits, receiver claims, timelock refunds.
contract RemittanceEscrow {
    IERC20 public immutable token;

    enum Status { Created, Released, Disputed, Refunded }

    struct Escrow {
        address sender;
        address receiver;
        uint256 amount;
        uint256 lockUntil;
        Status status;
    }

    mapping(bytes32 => Escrow) public escrows;
    uint256 private _counter;

    event EscrowCreated(bytes32 indexed escrowId, address indexed sender, address indexed receiver, uint256 amount, uint256 lockUntil);
    event EscrowReleased(bytes32 indexed escrowId);
    event EscrowDisputed(bytes32 indexed escrowId);
    event EscrowRefunded(bytes32 indexed escrowId);

    error NotSender();
    error NotReceiver();
    error StillLocked();
    error AlreadyClaimed();

    constructor(address _token) {
        token = IERC20(_token);
    }

    function createRemittance(address receiver, uint256 amount, uint256 lockPeriod) external returns (bytes32) {
        _counter++;
        bytes32 id = keccak256(abi.encodePacked(msg.sender, receiver, amount, block.timestamp, _counter));

        token.transferFrom(msg.sender, address(this), amount);
        escrows[id] = Escrow({
            sender: msg.sender,
            receiver: receiver,
            amount: amount,
            lockUntil: block.timestamp + lockPeriod,
            status: Status.Created
        });

        emit EscrowCreated(id, msg.sender, receiver, amount, block.timestamp + lockPeriod);
        return id;
    }

    function release(bytes32 escrowId) external {
        Escrow storage e = escrows[escrowId];
        if (msg.sender != e.receiver) revert NotReceiver();
        if (e.status != Status.Created) revert AlreadyClaimed();

        e.status = Status.Released;
        token.transfer(e.receiver, e.amount);
        emit EscrowReleased(escrowId);
    }

    function dispute(bytes32 escrowId) external {
        Escrow storage e = escrows[escrowId];
        if (msg.sender != e.sender && msg.sender != e.receiver) revert NotReceiver();
        if (e.status != Status.Created) revert AlreadyClaimed();

        e.status = Status.Disputed;
        emit EscrowDisputed(escrowId);
    }

    function refund(bytes32 escrowId) external {
        Escrow storage e = escrows[escrowId];
        if (msg.sender != e.sender) revert NotSender();
        if (e.status != Status.Created) revert AlreadyClaimed();
        if (block.timestamp < e.lockUntil) revert StillLocked();

        e.status = Status.Refunded;
        token.transfer(e.sender, e.amount);
        emit EscrowRefunded(escrowId);
    }
}
