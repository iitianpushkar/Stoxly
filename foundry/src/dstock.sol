// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {ConfirmedOwner} from "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {FunctionsRequest} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {SafeERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@chainlink/contracts/src/v0.8/vendor/openzeppelin-solidity/v4.8.3/contracts/token/ERC20/IERC20.sol";


// contract address :0xAcbF2d367407B0cd5E9a70420750C29992C3dB25
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

contract dstock is ConfirmedOwner, FunctionsClient, ERC20("dstock", "DSTOCK") {
    using SafeERC20 for IERC20;
    using FunctionsRequest for FunctionsRequest.Request;

    address constant AVALANCHE_FUJI_FUNCTIONS_ROUTER = 0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0;
    string s_mintSourceCode;
    string s_redeemSourceCode;
    uint64 immutable i_subId;
    bytes32 constant DON_ID = hex"66756e2d6176616c616e6368652d66756a692d31000000000000000000000000";
    uint32 constant GAS_LIMIT = 300_000;
    address FUJI_AVAX_PRICE_FEED =0x5498BB86BC934c8D34FDA08E81D444153d0D06aD;
    address i_usdcToken =0x5425890298aed601595a70AB815c96711a31Bc65; 


    uint64 s_secretVersion;
    uint8  s_secretSlot;

    constructor(
        string memory mintSourceCode,
        string memory redeemSourceCode,
        uint64 subId,
        uint64 secretVersion,
        uint8 secretSlot
    ) ConfirmedOwner(msg.sender) FunctionsClient(AVALANCHE_FUJI_FUNCTIONS_ROUTER) {
        s_mintSourceCode = mintSourceCode;
        s_redeemSourceCode = redeemSourceCode;
        i_subId = subId;
        s_secretVersion = secretVersion;
        s_secretSlot = secretSlot;
    }

        function setSecretVersion(uint64 secretVersion) external onlyOwner {
        s_secretVersion = secretVersion;
    }

        function setSecretSlot(uint8 secretSlot) external onlyOwner {
        s_secretSlot = secretSlot;
    }

    struct dstockRequest {
        address requester;
        uint256 numOfStocks;
        string stock;
        uint256 balance;
        bool isRedeem;
        bool isUSDC;
    }

    mapping(bytes32 requestId => dstockRequest) public requests;
    mapping(address holder => mapping(string stockName => uint256 stockNum)) public totalHoldings;      //  most important 
    mapping(address holder => string[] stock) public stockHoldings;                                     //    things


    function sendMintRequest(
        uint256 numOfStocks,
        string memory stock
    ) external payable returns (bytes32) {
        require(msg.value > 0, "Must send some AVAX to mint stocks");
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(s_mintSourceCode);
        req.addDONHostedSecrets(s_secretSlot, s_secretVersion);

        string[] memory args = new string[](2);
        args[0] = stock;
        args[1] = Strings.toString(numOfStocks);
        req.setArgs(args);

        bytes32 requestId = _sendRequest(
            req.encodeCBOR(),
            i_subId,
            GAS_LIMIT,
            DON_ID
        );
        requests[requestId] = dstockRequest({
            requester: msg.sender,
            numOfStocks: numOfStocks,
            stock: stock,
            balance: msg.value,
            isRedeem: false,
            isUSDC: false
        });
        return requestId;
    }

    function sendMintRequestCrossChainUsingUSDC(
        address requester,
        uint256 numOfStocks,
        string memory stock,
        uint256 amount
    ) external returns (bytes32) {
        require(amount > 0, "Must send some USDC to mint stocks");

        require(
            IERC20(i_usdcToken).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "USDC transfer failed"
        );
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(s_mintSourceCode);
        req.addDONHostedSecrets(s_secretSlot, s_secretVersion);

        string[] memory args = new string[](2);
        args[0] = stock;
        args[1] = Strings.toString(numOfStocks);
        req.setArgs(args);

        bytes32 requestId = _sendRequest(
            req.encodeCBOR(),
            i_subId,
            GAS_LIMIT,
            DON_ID
        );
        requests[requestId] = dstockRequest({
            requester: requester,
            numOfStocks: numOfStocks,
            stock: stock,
            balance: amount,
            isRedeem: false,
            isUSDC: true
        });
        return requestId;
    }


    function sendRedeemRequest(
    uint256 numOfStocks,
    string memory stock
) external returns (bytes32) {
    require(balanceOf(msg.sender) >= numOfStocks, "Not enough DSTOCK to redeem");

    FunctionsRequest.Request memory req;
    req.initializeRequestForInlineJavaScript(s_redeemSourceCode);
    req.addDONHostedSecrets(s_secretSlot, s_secretVersion);

    string[] memory args = new string[](2);
    args[0] = stock;
    args[1] = Strings.toString(numOfStocks);
    req.setArgs(args);

    bytes32 requestId = _sendRequest(
        req.encodeCBOR(),
        i_subId,
        GAS_LIMIT,
        DON_ID
    );

    requests[requestId] = dstockRequest({
        requester: msg.sender,
        numOfStocks: numOfStocks,
        stock: stock,
        balance: 0,
        isRedeem: true,
        isUSDC: false
    });

    return requestId;
}

function sendRedeemRequestCrossChainUsingUSDC(
    address requester,
    uint256 numOfStocks,
    string memory stock
) external returns (bytes32) {
    require(balanceOf(requester) >= numOfStocks, "Not enough DSTOCK to redeem");

    FunctionsRequest.Request memory req;
    req.initializeRequestForInlineJavaScript(s_redeemSourceCode);
    req.addDONHostedSecrets(s_secretSlot, s_secretVersion);

    string[] memory args = new string[](2);
    args[0] = stock;
    args[1] = Strings.toString(numOfStocks);
    req.setArgs(args);

    bytes32 requestId = _sendRequest(
        req.encodeCBOR(),
        i_subId,
        GAS_LIMIT,
        DON_ID
    );

    requests[requestId] = dstockRequest({
        requester: requester,
        numOfStocks: numOfStocks,
        stock: stock,
        balance: 0,
        isRedeem: true,
        isUSDC: true
    });

    return requestId;
}


    function fulfillRequest(
    bytes32 requestId,
    bytes memory response,
    bytes memory err
) internal override {
    if (requests[requestId].isRedeem && !requests[requestId].isUSDC) {
        _redeemFulfillRequest(requestId, response);
    } else if(!requests[requestId].isRedeem && !requests[requestId].isUSDC) {
        _mintFulfillRequest(requestId, response);
    }
    else if (requests[requestId].isRedeem && requests[requestId].isUSDC) {
        _redeemFulfillRequestForUSDC(requestId, response);
    } else if (!requests[requestId].isRedeem && requests[requestId].isUSDC) {
        _mintFulfillRequestForUSDC(requestId, response);
    } else {
        revert("Invalid request type");
    }
}


    function _mintFulfillRequest(
        bytes32 requestId,
        bytes memory response
    ) internal {
        dstockRequest memory req = requests[requestId];
        uint256 collateralRatioAdjustedBalance = getCollateralRatioAdjustedTotalBalance(requests[requestId].balance);
        uint256 stockPrice = uint256(bytes32(response));

        if(collateralRatioAdjustedBalance < stockPrice * req.numOfStocks) {

            payable(req.requester).transfer(req.balance);
            return;
        }

        _mint(req.requester, req.numOfStocks);


        stockHoldings[req.requester].push(req.stock);
        totalHoldings[req.requester][req.stock] += req.numOfStocks;

        uint256 remainingBalance = collateralRatioAdjustedBalance - (stockPrice * req.numOfStocks);
        if (remainingBalance > 0) {
            AggregatorV3Interface priceFeed = AggregatorV3Interface(FUJI_AVAX_PRICE_FEED);
            (, int256 price, , , ) = priceFeed.latestRoundData();
            require(price > 0, "Invalid AVAX price");

    
            uint256 avaxToSend = (remainingBalance * 1e18) / (uint256(price)*1e10);
            require(address(this).balance >= avaxToSend, "Contract lacks AVAX liquidity");
            payable(req.requester).transfer(avaxToSend);
        }
    }

    function _mintFulfillRequestForUSDC(
        bytes32 requestId,
        bytes memory response
    ) internal {
        dstockRequest memory req = requests[requestId];
        uint256 stockPrice = uint256(bytes32(response));

        if(req.balance*1e12 < stockPrice * req.numOfStocks) {
                IERC20(i_usdcToken).transfer(req.requester, req.balance);
            return;
        }
        _mint(req.requester, req.numOfStocks);


        stockHoldings[req.requester].push(req.stock);
        totalHoldings[req.requester][req.stock] += req.numOfStocks;

        uint256 remainingBalance = req.balance - (stockPrice * req.numOfStocks) / 1e12;
        if (remainingBalance > 0) {
            IERC20(i_usdcToken).transfer(req.requester, remainingBalance);
        }
    }

    function _redeemFulfillRequest(
    bytes32 requestId,
    bytes memory response
) internal {
    dstockRequest memory req = requests[requestId];
    require(balanceOf(req.requester) >= req.numOfStocks, "Not enough tokens to redeem");

    uint256 stockPrice = uint256(bytes32(response)); // same format

    // Calculate AVAX value based on price
    uint256 totalValueUSD = stockPrice * req.numOfStocks;

    AggregatorV3Interface priceFeed = AggregatorV3Interface(FUJI_AVAX_PRICE_FEED);
    (, int256 price, , , ) = priceFeed.latestRoundData();
    require(price > 0, "Invalid AVAX price");

    // USD to AVAX: totalValueUSD / AVAX price
    uint256 avaxToSend = (totalValueUSD * 1e18) / (uint256(price)*1e10);

    require(address(this).balance >= avaxToSend, "Contract lacks AVAX liquidity");

    _burn(req.requester, req.numOfStocks);
    totalHoldings[req.requester][req.stock] -= req.numOfStocks;

    payable(req.requester).transfer(avaxToSend);
}

function _redeemFulfillRequestForUSDC(
    bytes32 requestId,
    bytes memory response
) internal {
    dstockRequest memory req = requests[requestId];
    require(balanceOf(req.requester) >= req.numOfStocks, "Not enough tokens to redeem");

    uint256 stockPrice = uint256(bytes32(response)); 
    uint256 totalValueUSD = stockPrice * req.numOfStocks;

    
    uint256 USDCToSend = (totalValueUSD / 1e12);

    require(IERC20(i_usdcToken).balanceOf(address(this)) >= USDCToSend, "Contract lacks USDC liquidity");

    _burn(req.requester, req.numOfStocks);
    totalHoldings[req.requester][req.stock] -= req.numOfStocks;

    IERC20(i_usdcToken).transfer(req.requester, USDCToSend);
}




    function getCollateralRatioAdjustedTotalBalance(uint256 balance) public view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(FUJI_AVAX_PRICE_FEED);
        (, int256 price, , , ) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price feed data");

        uint256 collateralRatioAdjustedBalance = (balance * uint256(price) * 1e10)/1e18;

        return collateralRatioAdjustedBalance;
    }


    function withdraw() external onlyOwner {
    payable(owner()).transfer(address(this).balance);
}

// Function to withdraw USDC from the contract
function withdrawUSDC() external onlyOwner {
    uint256 usdcBalance = IERC20(i_usdcToken).balanceOf(address(this));
    require(usdcBalance > 0, "No USDC to withdraw");
    IERC20(i_usdcToken).transfer(owner(), usdcBalance);
}


function get_s_secretVersion() external view onlyOwner returns (uint64) {
    return s_secretVersion;
}

function get_s_secretSlot() external view onlyOwner returns (uint8) {
    return s_secretSlot;
}

function decimals() public view virtual override returns (uint8) {
        return 0; 
    }

function transfer(address to, uint256 amount) public virtual override returns (bool) {
    revert("Transfers are disabled");
}

function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
    revert("Transfers are disabled");
}

function getStockHoldings(address holder) external view returns (string[] memory) {
    return stockHoldings[holder];
}



}