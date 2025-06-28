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
    parseEther,
    encodeFunctionData,
    Chain,
  } from 'viem';
  import {
    type WalletProvider,
    initWalletProvider,
    SupportedChain
  } from '../providers/wallet';
  
  
  const tokenBalanceTemplate = `Extract the stock name, provide its official stock symbol, number of stock user wants to sell,
   from the user's message.
  
  User message: "{{userMessage}}"
  
  Return in this format:
  <response>
  <stockSym>STOCK_SYMBOL</stockSym>
  <stockNum>STOCK_NUM</stockNum>
  </response>
  
  If no stock is mentioned or it's not a stock selling intent , return:
  <response>
  <error>Not a stock sell request</error>
  </response>`;
  
  
  export const sendRedeemRequestAction: Action = {
    name: 'SEND_REDEEM_REQUEST',
    similes: ['REDEEM_REQUEST', 'SEND_REDEEM_REQUEST'],
    description: 'Sell the stock user wants to sell.',
  
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
  
      const prompt = tokenBalanceTemplate.replace('{{userMessage}}', message.content.text || '');
  
      const response = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt
      })
  
  
      console.log("response",response)
  
      const parsed = parseKeyValueXml(response);
  
        if (!parsed || parsed.error || !parsed.stockSym || !parsed.stockNum) {
          return { text: '', data: {}, values: {} };
        }
  
        const stockSym = parsed.stockSym.toUpperCase()
        const stockNum = parsed.stockNum
  
      const walletProvider = await initWalletProvider(runtime);
      if (!walletProvider) {
        elizaLogger.error('Failed to initialize wallet provider in sendMintRequestAction');
        return;
      }
  
      try {
        // Step 1: Get wallet and chain info
        const address = walletProvider.getAddress();
        const chains = walletProvider.chains;
        const firstChainKey = Object.keys(chains)[0] as SupportedChain;
        const chain = chains[firstChainKey];
        const walletClient = walletProvider.getWalletClient(firstChainKey);
        const publicClient = walletProvider.getPublicClient(firstChainKey);
  
        if (!walletClient || !publicClient) {
          elizaLogger.error('Wallet or public client not found');
          return;
        }
  
        // Step 2: Define contract
        const contractAddress = '0xAcbF2d367407B0cd5E9a70420750C29992C3dB25';
        const abi = [ 
          {
            "inputs": [
              {
                "internalType": "uint256",
                "name": "numOfStocks",
                "type": "uint256"
              },
              {
                "internalType": "string",
                "name": "stock",
                "type": "string"
              }
            ],
            "name": "sendRedeemRequest",
            "outputs": [
              {
                "internalType": "bytes32",
                "name": "",
                "type": "bytes32"
              }
            ],
            "stateMutability": "nonpayable",
            "type": "function"
          }
                                
        ];
  
        // Step 3: Define args — these can be parsed from memory/state if you like
        const numOfStocks = stockNum;
        const stock = stockSym as string; 
  
        const data = encodeFunctionData({
          abi,
          functionName: 'sendRedeemRequest',
          args: [numOfStocks, stock],
        });
  
        const gasPrice = await publicClient.getGasPrice();
        const gas = await publicClient.estimateGas({
          account: address,
          to: contractAddress,
          data,
        });
  
        // 👇 Get the correct nonce for the sender
        const nonce = await publicClient.getTransactionCount({
          address,
          blockTag: 'pending', // ensures the latest
        });
  
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
  
  
  
  
        const resultText = `Sent redeemRequest for ${stock} x${numOfStocks}. Transaction hash: ${txHash}`;
  
        if (callback) {
          callback({
            text: resultText,
            content: { txHash, stock, numOfStocks }
          });
        }
  
        return {
          text: resultText,
          content: { txHash, stock, numOfStocks }
        };
      } catch (err) {
        elizaLogger.error('Error in sendRedeemRequestAction:', err);
        if (callback) {
          callback({ text: `Transaction failed: ${err.message}` });
        }
      }
    }
  };
  