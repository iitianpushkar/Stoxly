// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableMap} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/utils/structs/EnumerableMap.sol";


// contract address : 0x4d833669E8D503cFF3E4648d2df41B49241EC08E

contract Receiver is CCIPReceiver, OwnerIsCreator {
    using SafeERC20 for IERC20;
    using EnumerableMap for EnumerableMap.Bytes32ToUintMap;

    error InvalidUsdcToken(); // Used when the usdc token address is 0
    error InvalidStaker(); // Used when the staker address is 0
    error InvalidSourceChain(); // Used when the source chain is 0
    error InvalidSenderAddress(); // Used when the sender address is 0
    error NoSenderOnSourceChain(uint64 sourceChainSelector); // Used when there is no sender for a given source chain
    error WrongSenderForSourceChain(uint64 sourceChainSelector); // Used when the sender contract is not the correct one
    error OnlySelf(); // Used when a function is called outside of the contract itself
    error WrongReceivedToken(address usdcToken, address receivedToken); // Used if the received token is different than usdc token
    error CallToContractFailed(); // Used when the call to the stake function of the staker contract is not successful
    error NoReturnDataExpected(); // Used if the call to the stake function of the staker contract returns data. This is not expected
    error MessageNotFailed(bytes32 messageId); // Used if you try to retry a message that has no failed

    event MessageReceived(
        bytes32 indexed messageId, // The unique ID of the CCIP message.
        uint64 indexed sourceChainSelector, // The chain selector of the source chain.
        address indexed sender, // The address of the sender from the source chain.
        bytes data, // The data that was received.
        address token, // The token address that was transferred.
        uint256 tokenAmount // The token amount that was transferred.
    );

    event MessageFailed(bytes32 indexed messageId, bytes reason);
    event MessageRecovered(bytes32 indexed messageId);

   
    enum ErrorCode {
        RESOLVED,
        FAILED
    }

    struct FailedMessage {
        bytes32 messageId;
        ErrorCode errorCode;
    }

    IERC20 private immutable i_usdcToken;
    address private immutable i_dstock;

    mapping(uint64 => address) public s_senders;

    mapping(bytes32 => Client.Any2EVMMessage) public s_messageContents;

    EnumerableMap.Bytes32ToUintMap internal s_failedMessages;

    modifier validateSourceChain(uint64 _sourceChainSelector) {
        if (_sourceChainSelector == 0) revert InvalidSourceChain();
        _;
    }

    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelf();
        _;
    }

    constructor(
        address _router,
        address _usdcToken,
        address _dstock
    ) CCIPReceiver(_router) {
        if (_usdcToken == address(0)) revert InvalidUsdcToken();
        if (_dstock == address(0)) revert InvalidStaker();
        i_usdcToken = IERC20(_usdcToken);
        i_dstock = _dstock;
        i_usdcToken.safeApprove(_dstock, type(uint256).max);
    }

    function setSenderForSourceChain(
        uint64 _sourceChainSelector,
        address _sender
    ) external onlyOwner validateSourceChain(_sourceChainSelector) {
        if (_sender == address(0)) revert InvalidSenderAddress();
        s_senders[_sourceChainSelector] = _sender;
    }


    function deleteSenderForSourceChain(
        uint64 _sourceChainSelector
    ) external onlyOwner validateSourceChain(_sourceChainSelector) {
        if (s_senders[_sourceChainSelector] == address(0))
            revert NoSenderOnSourceChain(_sourceChainSelector);
        delete s_senders[_sourceChainSelector];
    }

    function ccipReceive(
        Client.Any2EVMMessage calldata any2EvmMessage
    ) external override onlyRouter {
        if (
            abi.decode(any2EvmMessage.sender, (address)) !=
            s_senders[any2EvmMessage.sourceChainSelector]
        ) revert WrongSenderForSourceChain(any2EvmMessage.sourceChainSelector);
        /* solhint-disable no-empty-blocks */
        try this.processMessage(any2EvmMessage) {
            
        } catch (bytes memory err) {
            s_failedMessages.set(
                any2EvmMessage.messageId,
                uint256(ErrorCode.FAILED)
            );
            s_messageContents[any2EvmMessage.messageId] = any2EvmMessage;
            emit MessageFailed(any2EvmMessage.messageId, err);
            return;
        }
    }

    function processMessage(
        Client.Any2EVMMessage calldata any2EvmMessage
    ) external onlySelf {
        _ccipReceive(any2EvmMessage); 
    }

    function _ccipReceive(
        Client.Any2EVMMessage memory any2EvmMessage
    ) internal override {
        if (any2EvmMessage.destTokenAmounts[0].token != address(i_usdcToken))
            revert WrongReceivedToken(
                address(i_usdcToken),
                any2EvmMessage.destTokenAmounts[0].token
            );

        (bool success, bytes memory returnData) = i_dstock.call(
            any2EvmMessage.data
        ); 
        if (!success) revert CallToStakerFailed();
        if (returnData.length > 0) revert NoReturnDataExpected();
        emit MessageReceived(
            any2EvmMessage.messageId,
            any2EvmMessage.sourceChainSelector, 
            abi.decode(any2EvmMessage.sender, (address)), 
            any2EvmMessage.data,
            any2EvmMessage.destTokenAmounts[0].token,
            any2EvmMessage.destTokenAmounts[0].amount
        );
    }

    function retryFailedMessage(
        bytes32 messageId,
        address beneficiary
    ) external onlyOwner {
        
        if (s_failedMessages.get(messageId) != uint256(ErrorCode.FAILED))
            revert MessageNotFailed(messageId);

        s_failedMessages.set(messageId, uint256(ErrorCode.RESOLVED));

        Client.Any2EVMMessage memory message = s_messageContents[messageId];

        IERC20(message.destTokenAmounts[0].token).safeTransfer(
            beneficiary,
            message.destTokenAmounts[0].amount
        );

        
        emit MessageRecovered(messageId);
    }

    function getFailedMessages(
        uint256 offset,
        uint256 limit
    ) external view returns (FailedMessage[] memory) {
        uint256 length = s_failedMessages.length();

        uint256 returnLength = (offset + limit > length)
            ? length - offset
            : limit;
        FailedMessage[] memory failedMessages = new FailedMessage[](
            returnLength
        );

        for (uint256 i = 0; i < returnLength; i++) {
            (bytes32 messageId, uint256 errorCode) = s_failedMessages.at(
                offset + i
            );
            failedMessages[i] = FailedMessage(messageId, ErrorCode(errorCode));
        }
        return failedMessages;
    }
}
