import {
    IAgentRuntime,
    Provider,
    ProviderResult,
    Memory,
    State,
    elizaLogger,
} from '@elizaos/core';

import { initWalletProvider, SupportedChain } from './wallet';



export const AvaxUsdExc:Provider={
    name: 'AVAXUSDExchangeRateProvider',
    description: 'A provider for getting AVAX to USD exchange rate',

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
        elizaLogger.info('Wallet provider initialized successfully');
        const address = walletProvider.getAddress(); 
        elizaLogger.info(`Wallet address: ${address}`);

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

        const abi = [{
            "inputs": [
              {
                "internalType": "uint256",
                "name": "balance",
                "type": "uint256"
              }
            ],
            "name": "getCollateralRatioAdjustedTotalBalance",
            "outputs": [
              {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
              }
            ],
            "stateMutability": "view",
            "type": "function"
          }
          ]

        const exchangeRate = await publicClient.readContract({
            address: '0xAcbF2d367407B0cd5E9a70420750C29992C3dB25',
            abi: abi,
            functionName: 'getCollateralRatioAdjustedTotalBalance',
            args: [1], 
        })

        const agentName = state?.agentName || 'The agent'
        return {
            text: `The current exchange rate for AVAX to USD is ${exchangeRate} USD per AVAX.`,
            values: {
            },
            data: {
            },
          };
    }
}