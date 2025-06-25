import {
    IAgentRuntime,
    Provider,
    ProviderResult,
    Memory,
    State,
    elizaLogger,
} from '@elizaos/core';

import { initWalletProvider, SupportedChain } from './wallet';
import { formatEther } from 'viem';



export const getBalance:Provider={
    name: 'WalletBalanceProvider',
    description: 'A provider for getting wallet balance',

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

        const balance = await publicClient.getBalance({address:address});

        const agentName = state?.agentName || 'The agent'
        return {
            text: `${agentName} has ${formatEther(balance)} AVAX.`,
            values: {
            },
            data: {
                address: address,
                balance: formatEther(balance),
                chain: Object.keys(chains)[0],
            },
          };
    }
}