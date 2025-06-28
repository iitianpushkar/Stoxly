// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IRouterClient} from "@chainlink/contracts/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts/src/v0.8/ccip/libraries/Client.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";


// contract address: 0x377A2Dd0C48d5023dEf44c9a0E1c982fcA89F397
interface Idstock {
    function sendMintRequestCrossChainUsingUSDC(
        address requester,
        uint256 numOfStocks,
        string memory stock,
        uint256 amount
    ) external returns (bytes32);

    function sendRedeemRequestCrossChainUsingUSDC(
        address requester,
        uint256 numOfStocks,
        string memory stock
    ) external returns (bytes32);
}

contract Sender is OwnerIsCreator {
    using SafeERC20 for IERC20;

    error InvalidRouter(); // Used when the router address is 0
    error InvalidLinkToken(); // Used when the link token address is 0
    error InvalidUsdcToken(); // Used when the usdc token address is 0
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance to cover the fees.
    error NothingToWithdraw(); // Used when trying to withdraw Ether but there's nothing to withdraw.
    error InvalidDestinationChain(); // Used when the destination chain selector is 0.
    error InvalidReceiverAddress(); // Used when the receiver address is 0.
    error NoReceiverOnDestinationChain(uint64 destinationChainSelector); // Used when the receiver address is 0 for a given destination chain.
    error AmountIsZero(); // Used if the amount to transfer is 0.
    error InvalidGasLimit(); // Used if the gas limit is 0.
    error NoGasLimitOnDestinationChain(uint64 destinationChainSelector); // Used when the gas limit is 0.

    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address indexed receiver, 
        address beneficiary,
        address token, 
        uint256 tokenAmount, 
        address feeToken, 
        uint256 fees 
    );

    IRouterClient private immutable i_router;
    IERC20 private immutable i_linkToken;
    IERC20 private immutable i_usdcToken;

    mapping(uint64 => address) public s_receivers;
    mapping(uint64 => uint256) public s_gasLimits;

    modifier validateDestinationChain(uint64 _destinationChainSelector) {
        if (_destinationChainSelector == 0) revert InvalidDestinationChain();
        _;
    }
    constructor(address _router, address _link, address _usdcToken) {
        if (_router == address(0)) revert InvalidRouter();
        if (_link == address(0)) revert InvalidLinkToken();
        if (_usdcToken == address(0)) revert InvalidUsdcToken();
        i_router = IRouterClient(_router);
        i_linkToken = IERC20(_link);
        i_usdcToken = IERC20(_usdcToken);
    }

    function setReceiverForDestinationChain(
        uint64 _destinationChainSelector,
        address _receiver
    ) external onlyOwner validateDestinationChain(_destinationChainSelector) {
        if (_receiver == address(0)) revert InvalidReceiverAddress();
        s_receivers[_destinationChainSelector] = _receiver;
    }

    function setGasLimitForDestinationChain(
        uint64 _destinationChainSelector,
        uint256 _gasLimit
    ) external onlyOwner validateDestinationChain(_destinationChainSelector) {
        if (_gasLimit == 0) revert InvalidGasLimit();
        s_gasLimits[_destinationChainSelector] = _gasLimit;
    }


    function deleteReceiverForDestinationChain(
        uint64 _destinationChainSelector
    ) external onlyOwner validateDestinationChain(_destinationChainSelector) {
        if (s_receivers[_destinationChainSelector] == address(0))
            revert NoReceiverOnDestinationChain(_destinationChainSelector);
        delete s_receivers[_destinationChainSelector];
    }

    function sendMessagePayLINK(
         uint64 _destinationChainSelector,
    uint256 _amount,
    uint256 _numOfStocks,
    string memory _stock
    )
        external
        validateDestinationChain(_destinationChainSelector)
        returns (bytes32 messageId)
    {
        address receiver = s_receivers[_destinationChainSelector];
        if (receiver == address(0))
            revert NoReceiverOnDestinationChain(_destinationChainSelector);
        if (_amount == 0) revert AmountIsZero();
        uint256 gasLimit = s_gasLimits[_destinationChainSelector];
        if (gasLimit == 0)
            revert NoGasLimitOnDestinationChain(_destinationChainSelector);

            require(i_usdcToken.safeTransferFrom(
                msg.sender,
                address(this),
                _amount
            ), "USDC transfer failed");
        

        Client.EVMTokenAmount[]
            memory tokenAmounts = new Client.EVMTokenAmount[](1);
        tokenAmounts[0] = Client.EVMTokenAmount({
            token: address(i_usdcToken),
            amount: _amount
        });
        
        Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
            receiver: abi.encode(receiver), 
            data: abi.encodeWithSelector(
                Idstock.sendMintRequestCrossChainUsingUSDC.selector,
                msg.sender,
                _numOfStocks,
                _stock,
                _amount
            ), 
            tokenAmounts: tokenAmounts,
            extraArgs: Client._argsToBytes(
                Client.EVMExtraArgsV2({
                    gasLimit: gasLimit, 
                    allowOutOfOrderExecution: true
            ),
            
            feeToken: address(i_linkToken)
        });

        uint256 fees = i_router.getFee(
            _destinationChainSelector,
            evm2AnyMessage
        );

        if (fees > i_linkToken.balanceOf(address(this)))
            revert NotEnoughBalance(i_linkToken.balanceOf(address(this)), fees);

        
        i_linkToken.approve(address(i_router), fees);

        
        i_usdcToken.approve(address(i_router), _amount);

        
        messageId = i_router.ccipSend(
            _destinationChainSelector,
            evm2AnyMessage
        );

        
        emit MessageSent(
            messageId,
            _destinationChainSelector,
            receiver,
            msg.sender,
            address(i_usdcToken),
            _amount,
            address(i_linkToken),
            fees
        );

    
        return messageId;
    }

    function withdrawLinkToken(address _beneficiary) public onlyOwner {
        
        uint256 amount = i_linkToken.balanceOf(address(this));

        if (amount == 0) revert NothingToWithdraw();

        i_linkToken.safeTransfer(_beneficiary, amount);
    }

    function withdrawUsdcToken(address _beneficiary) public onlyOwner {
        uint256 amount = i_usdcToken.balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();

        i_usdcToken.safeTransfer(_beneficiary, amount);
    }
}