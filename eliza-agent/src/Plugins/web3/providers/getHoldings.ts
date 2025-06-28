import {
  IAgentRuntime,
  Provider,
  ProviderResult,
  Memory,
  State,
  elizaLogger,
} from '@elizaos/core';

import { initWalletProvider, SupportedChain } from './wallet';

export const stockHoldings: Provider = {
  name: 'stockHoldings',
  description: 'A provider for getting stock holdings',

  get: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state: State
  ): Promise<ProviderResult> => {
    const walletProvider = await initWalletProvider(runtime);
    if (!walletProvider) {
      elizaLogger.error('Failed to initialize wallet provider');
      return {
        text: 'Failed to initialize wallet provider',
        values: {},
        data: {},
      };
    }

    const address = walletProvider.getAddress();
    const chains = walletProvider.chains;
    const publicClient = walletProvider.getPublicClient(Object.keys(chains)[0] as SupportedChain);

    if (!publicClient) {
      elizaLogger.error('Public client not found for the chain');
      return {
        text: 'Public client not found for the chain',
        values: {},
        data: {},
      };
    }

    const abi = [
      {
        "inputs": [{ "internalType": "address", "name": "holder", "type": "address" }],
        "name": "getStockHoldings",
        "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          { "internalType": "address", "name": "holder", "type": "address" },
          { "internalType": "string", "name": "stockName", "type": "string" }
        ],
        "name": "totalHoldings",
        "outputs": [{ "internalType": "uint256", "name": "stockNum", "type": "uint256" }],
        "stateMutability": "view",
        "type": "function"
      }
    ];

    const contractAddress = '0xAcbF2d367407B0cd5E9a70420750C29992C3dB25';

    try {
      const rawHoldings = await publicClient.readContract({
        address: contractAddress,
        abi,
        functionName: 'getStockHoldings',
        args: [address],
      }) as string[];

      const uniqueHoldings = Array.from(new Set(rawHoldings));

      const stockQuantities: Record<string, string> = {};

      for (const stock of uniqueHoldings) {
        const amount = await publicClient.readContract({
          address: contractAddress,
          abi,
          functionName: 'totalHoldings',
          args: [address, stock],
        }) as bigint;

        stockQuantities[stock] = amount.toString();
      }

      return {
        text: `You hold ${uniqueHoldings.length} stock(s): ${uniqueHoldings.map(s => `${s} (${stockQuantities[s]})`).join(', ')}`,
        values: {
          count: uniqueHoldings.length,
        },
        data: {
          stocks: stockQuantities,
        },
      };
    } catch (err: any) {
      elizaLogger.error('Error reading contract: ' + err.message);
      return {
        text: 'Failed to fetch stock holdings.',
        values: {},
        data: {},
      };
    }
  }
};
