import {
    type Action,
    AgentRuntime,
    type HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
    elizaLogger,
    ModelType,
    parseKeyValueXml,
  } from '@elizaos/core';
  
  import {
    parseUnits,
    encodeFunctionData,
    erc20Abi,
  } from 'viem';
  
  import {
    type WalletProvider,
    initWalletProvider,
    SupportedChain,
  } from '../providers/wallet';
  
  const crossChainMintTemplate = `
  Extract the stock name, provide its official stock symbol, number of stocks user wants to buy, and the USDC amount 
  user wants to use for the purchase.
  
  User message: "{{userMessage}}"
  
  Return in this format:
  <response>
  <stockSym>STOCK_SYMBOL</stockSym>
  <stockNum>STOCK_NUM</stockNum>
  <spendAmount>amount_USDC</spendAmount>
  </response>
  
  If no stock with usdc is mentioned or it's not a stock buying using usdc inquiry, return:
  <response>
  <error>Not a stock buy request using usdc</error>
  </response>`;
  
  export const sendMessagePayLinkAction: Action = {
    name: 'Buy Stock Using USDC',
    similes: ['buy stock using usdc', 'mint stock with usdc', 'cross-chain stock mint'],
    description: 'Send a cross-chain stock mint request using USDC.',
  
    validate: async (_runtime, _message, _state) => true,
  
    handler: async (
      runtime: IAgentRuntime,
      message: Memory,
      state: State | undefined,
      _options: any,
      callback?: HandlerCallback
    ) => {
      if (!state) {
        state = (await runtime.composeState(message)) as State;
      }
  
      const prompt = crossChainMintTemplate.replace('{{userMessage}}', message.content.text || '');
      const response = await runtime.useModel(ModelType.TEXT_SMALL, { prompt });
      const parsed = parseKeyValueXml(response);
  
      if (!parsed || parsed.error || !parsed.stockSym || !parsed.stockNum || !parsed.spendAmount) {
        return { text: 'Invalid input', data: {}, values: {} };
      }
  
      const stock = parsed.stockSym.toUpperCase();
      const stockNum = parsed.stockNum;
      const usdcAmount = parsed.spendAmount; 

      console.log("Parsed values:", {
        stock,
        stockNum,
        usdcAmount
      });
  
      const walletProvider = await initWalletProvider(runtime);
      if (!walletProvider) {
        elizaLogger.error('Wallet provider not initialized.');
        return;
      }
  
      try {
        const address = walletProvider.getAddress();
        const chains = walletProvider.chains;
        const secondChainKey = Object.keys(chains)[1] as SupportedChain;
        const chain = chains[secondChainKey];
        const walletClient = walletProvider.getWalletClient(secondChainKey);
        const publicClient = walletProvider.getPublicClient(secondChainKey);
  
        if (!walletClient || !publicClient) {
          elizaLogger.error('Missing wallet/public client.');
          return;
        }
  
        const destinationChainSelector = "14767482510784806043";
  
        const contractAddress = '0x377a2dd0c48d5023def44c9a0e1c982fca89f397';
        const usdcAddress = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

       await walletClient.writeContract({
        address: usdcAddress,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contractAddress, parseUnits(usdcAmount, 6)],
        account: address,
        chain: chain,
});
        const abi = [
          {
            "name": "sendMessagePayLINK",
            "type": "function",
            "stateMutability": "nonpayable",
            "inputs": [
              { "name": "_destinationChainSelector", "type": "uint64" },
              { "name": "_amount", "type": "uint256" },
              { "name": "_numOfStocks", "type": "uint256" },
              { "name": "_stock", "type": "string" }
            ],
            "outputs": [{ "type": "bytes32" }]
          }
        ];
  
        const data = encodeFunctionData({
          abi,
          functionName: 'sendMessagePayLINK',
          args: [destinationChainSelector, parseUnits(usdcAmount,6), stockNum, stock],
        });
  
        const gas = await publicClient.estimateGas({
          account: address,
          to: contractAddress,
          data,
        });
  
        const gasPrice = await publicClient.getGasPrice();
        const nonce = await publicClient.getTransactionCount({ address, blockTag: 'pending' });
  
        const serializedTx = await walletClient.account.signTransaction({
          to: contractAddress,
          data,
          gas,
          gasPrice,
          nonce,
          chainId: chain.id,
        });
  
        const txHash = await publicClient.sendRawTransaction({
          serializedTransaction: serializedTx,
        });
  
        const resultText = `✅ Sent cross-chain stock mint request for ${stock} x${stockNum}. TX: ${txHash}`;
        if (callback) callback({ text: resultText, content: { txHash, stock, stockNum } });
        return { text: resultText, content: { txHash, stock } };
  
      } catch (err: any) {
        elizaLogger.error('Error in sendMessagePayLinkAction:', err);
        if (callback) callback({ text: `Transaction failed: ${err.message}` });
      }
    }
  };
  