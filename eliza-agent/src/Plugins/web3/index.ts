import { Plugin } from "@elizaos/core";
import { evmWalletProvider } from "./providers/wallet";
import { sendMintRequestAction } from "./actions/sendMintRequest";
import { stockHoldings } from "./providers/getHoldings";
import { getBalance } from "./providers/getBalance";
import { AvaxUsdExc } from "./providers/getAvaxUsd";
import { StockUsdExc } from "./providers/getStockUsd";
import { sendRedeemRequestAction } from "./actions/sendRedeemRequest";
import { getUSDCBalance } from "./providers/getUSDCBalance";
import { sendMessagePayLinkAction } from "./actions/sendMintUsingUSDC";

export const web3Plugin: Plugin = {
  name: "web3",
  description: "Web3 plugin for interacting with EVM chains",
  actions: [sendMintRequestAction,sendRedeemRequestAction,sendMessagePayLinkAction],
  providers: [evmWalletProvider, stockHoldings, getBalance, AvaxUsdExc, StockUsdExc,getUSDCBalance],
};