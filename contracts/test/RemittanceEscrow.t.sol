// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {RemittanceEscrow} from "../src/RemittanceEscrow.sol";
import {MockERC20} from "../src/MockERC20.sol";

contract RemittanceEscrowTest is Test {
    RemittanceEscrow escrow;
    MockERC20 token;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address eve = makeAddr("eve");

    uint256 constant AMOUNT = 1_000e6; // 1k usdc
    uint256 constant LOCK = 3 days;

    function setUp() public {
        token = new MockERC20("USDC", "USDC");
        escrow = new RemittanceEscrow(address(token));

        token.mint(alice, AMOUNT * 10);
        vm.prank(alice);
        token.approve(address(escrow), type(uint256).max);
    }

    function _create() internal returns (bytes32) {
        vm.prank(alice);
        return escrow.createRemittance(bob, AMOUNT, LOCK);
    }

    // ── create ──

    function testCreateTransfersTokens() public {
        bytes32 id = _create();
        assertEq(token.balanceOf(address(escrow)), AMOUNT);
        assertEq(token.balanceOf(alice), AMOUNT * 9);

        (address sender, address receiver, uint256 amount, , RemittanceEscrow.Status status) = escrow.escrows(id);
        assertEq(sender, alice);
        assertEq(receiver, bob);
        assertEq(amount, AMOUNT);
        assertEq(uint8(status), uint8(RemittanceEscrow.Status.Created));
    }

    function testCreateEmitsEvent() public {
        // skip escrowId topic (can't predict), check sender+receiver, skip data
        vm.expectEmit(false, true, true, false);
        emit RemittanceEscrow.EscrowCreated(bytes32(0), alice, bob, 0, 0);
        _create();
    }

    // ── release ──

    function testReleaseByReceiver() public {
        bytes32 id = _create();
        vm.prank(bob);
        escrow.release(id);

        assertEq(token.balanceOf(bob), AMOUNT);
        (, , , , RemittanceEscrow.Status status) = escrow.escrows(id);
        assertEq(uint8(status), uint8(RemittanceEscrow.Status.Released));
    }

    function testReleaseByReceiverEmits() public {
        bytes32 id = _create();
        vm.expectEmit();
        emit RemittanceEscrow.EscrowReleased(id);
        vm.prank(bob);
        escrow.release(id);
    }

    function testReleaseByNonReceiverReverts() public {
        bytes32 id = _create();
        vm.prank(eve);
        vm.expectRevert(RemittanceEscrow.NotReceiver.selector);
        escrow.release(id);
    }

    function testReleaseTwiceReverts() public {
        bytes32 id = _create();
        vm.prank(bob);
        escrow.release(id);
        vm.prank(bob);
        vm.expectRevert(RemittanceEscrow.AlreadyClaimed.selector);
        escrow.release(id);
    }

    // ── dispute ──

    function testDisputeBySender() public {
        bytes32 id = _create();
        vm.prank(alice);
        escrow.dispute(id);
        (, , , , RemittanceEscrow.Status status) = escrow.escrows(id);
        assertEq(uint8(status), uint8(RemittanceEscrow.Status.Disputed));
    }

    function testDisputeByReceiver() public {
        bytes32 id = _create();
        vm.prank(bob);
        escrow.dispute(id);
        (, , , , RemittanceEscrow.Status status) = escrow.escrows(id);
        assertEq(uint8(status), uint8(RemittanceEscrow.Status.Disputed));
    }

    function testDisputeByThirdPartyReverts() public {
        bytes32 id = _create();
        vm.prank(eve);
        vm.expectRevert(RemittanceEscrow.NotReceiver.selector);
        escrow.dispute(id);
    }

    // ── refund ──

    function testRefundAfterLock() public {
        bytes32 id = _create();
        vm.warp(block.timestamp + LOCK + 1);
        vm.prank(alice);
        escrow.refund(id);

        assertEq(token.balanceOf(alice), AMOUNT * 10);
        (, , , , RemittanceEscrow.Status status) = escrow.escrows(id);
        assertEq(uint8(status), uint8(RemittanceEscrow.Status.Refunded));
    }

    function testRefundBeforeLockReverts() public {
        bytes32 id = _create();
        vm.prank(alice);
        vm.expectRevert(RemittanceEscrow.StillLocked.selector);
        escrow.refund(id);
    }

    function testRefundByNonSenderReverts() public {
        bytes32 id = _create();
        vm.warp(block.timestamp + LOCK + 1);
        vm.prank(bob);
        vm.expectRevert(RemittanceEscrow.NotSender.selector);
        escrow.refund(id);
    }

    function testRefundAfterReleaseReverts() public {
        bytes32 id = _create();
        vm.prank(bob);
        escrow.release(id);
        vm.warp(block.timestamp + LOCK + 1);
        vm.prank(alice);
        vm.expectRevert(RemittanceEscrow.AlreadyClaimed.selector);
        escrow.refund(id);
    }
}
