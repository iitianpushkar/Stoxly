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

## 🏗️ Architecture
![architecture](/dstockArchitecture.jpg)

### 🟢 Mint Flow

1. User chats with the ElizaOS agent:  
   _"Buy 3 shares of AAPL using 100 AVAX"_

2. Agent calls the mint function of the `dstock` smart contract on Avalanche Fuji.

3. On-chain logic via Chainlink Functions:
   - Fetches real-time **stock price (e.g., AAPL)** in USD
   - Fetches **AVAX/USD price** from Chainlink Price Feed

4. Contract logic:
   ```solidity
   if (avax_in_usd >= stock_price_usd * quantity) {
       mint DSTOCK token(s)
       update totalHoldings[requester][stock]
       refund excess AVAX
   }
### 🔴 Redeem Flow

1. User chats with the agent:
   _"Redeem 2 shares of TSLA"_

2. Agent calls the redeem function of the `dstock` smart contract.

3. On-chain logic via Chainlink Functions:
   - Fetches real-time stock price in USD
   - Uses Chainlink Price Feed for AVAX/USD

4. Contract logic:
   ```solidity
   if (totalHoldings[requester][stock] >= quantity) {
    burn DSTOCK token(s)
    update totalHoldings
    send back equivalent AVAX
   }  

### 🌐 Cross-Chain Flow (Sepolia → Avalanche Fuji)
1. User on a different chain (e.g., Sepolia) wants to mint/redeem a stock using USDC.

2. Agent interacts with Sender Contract on the source chain.

3. Sender Contract sends USDC + metadata (stock, qty, requester) to Avalanche Fuji via Chainlink CCIP.

4. Receiver Contract on Avalanche Fuji forwards data to the DSTOCK contract.

5. DSTOCK contract completes mint/redeem operation as usual.

## 📦 Deployments

| Component                     | Link / Address |
|-------------------------------|----------------|
| **dstock contract(Fuji)**     | `0xAcbF2d367407B0cd5E9a70420750C29992C3dB25` |
| **Sender Contract (Sepolia)** | `0x377A2Dd0C48d5023dEf44c9a0E1c982fcA89F397` |
| **Receiver Contract (Fuji)**  | `0x4d833669E8D503cFF3E4648d2df41B49241EC08E` |

---

## 📹 Demo Video

▶️ [Watch Demo](https://youtu.be/jfRgW0D9VWc?si=jjtQZn3RlVs4nURp)
   
