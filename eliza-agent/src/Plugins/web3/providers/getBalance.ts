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
     //   console.log('Available chains:', Object.keys(chains));
        const balances=[];

        for( const chainName in chains) {

        const publicClient = walletProvider.getPublicClient(chainName as SupportedChain);
      //  console.log('Public client for chain:', publicClient);
        if (!publicClient) {
          elizaLogger.error('Public client not found for the chain');
          return {
            text: 'Public client not found for the chain',
            values: {},
            data: {},
          };
        }

        const balance = await publicClient.getBalance({address:address});
       // elizaLogger.info(`Balance for ${chainName}: ${balance}`);
        balances.push({chain: chainName, balance: balance});

        }
        const agentName = state?.agentName || 'The agent'
        return {
            text: `${agentName} has the following balances: ${balances.map(b => `${b.chain}: ${formatEther(b.balance)}`).join(', ')}`,
            values: {
            },
            data: {
                address: address,
                chains: Object.keys(walletProvider.chains),
            },
          };
    }
}