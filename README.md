## 🟦 Stoxly
Tokenization of every US Stock — at the intersection of Blockchain and AI

## 🧩 Problem
Investing in U.S. stocks using crypto remains inaccessible for most global users. Current systems are either centralized or geographically restricted, preventing seamless participation from crypto-native users.
Furthermore, no system exists that bridges on-chain capital with real-time stock market execution in a decentralized, programmable, and intelligent way
There's also a lack of autonomous agents capable of execution of on-chain actions on behalf of users.

## 💡 Solution

**Stoxly** enables crypto users to purchase tokenized U.S. stocks through a single token model (`DSTOCK`), using AVAX on Avalanche Fuji and stablecoin like USDC across multiple chains.
Each user’s stock purchases are recorded in a verifiable on-chain ledger, enabling transparency and ownership without intermediaries. By leveraging Chainlink Functions, Stoxly fetches real-time stock prices and AVAX/USD conversion rates to ensure fair token issuance and redemptions.
An AI agent powered by **ElizaOS** serves as the user interface, allowing users to chat with their wallet, check holdings, and initiate mint or redeem operations—all without using a traditional frontend.

## 🏗️ Architecture & On-Chain Logic

The architecture consists of two smart contracts: a **sender contract** (on Sepolia) and a **receiver contract** (on Avalanche Fuji). The user interacts with an AI agent that facilitates the request to mint or redeem stocks.

### 🔹 Mint Flow

1. The user sends USDC via **Chainlink CCIP** from Sepolia to the Avalanche receiver contract.
2. The receiver fetches the **real-time stock price** and **AVAX/USD conversion rate** using **Chainlink Functions**.
3. On-chain logic:

   ```solidity
   if (avaxSentInUSD >= totalCostOfShares) {
       mintDSTOCK(requester);
       stockHoldings[requester].push(stock);
       totalHoldings[requester][stock] += quantity;
   }
