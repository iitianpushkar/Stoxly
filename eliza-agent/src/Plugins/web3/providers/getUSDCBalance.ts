import {
    IAgentRuntime,
    Provider,
    ProviderResult,
    Memory,
    State,
    elizaLogger,
  } from '@elizaos/core';
  
  import { initWalletProvider, SupportedChain } from './wallet';
  import { formatEther, formatUnits, parseUnits } from 'viem';
  
  // Mapping of known USDC contract addresses per chain
  const USDC_ADDRESSES: Partial<Record<SupportedChain, `0x${string}`>> = {
    avalancheFuji: '0x5425890298aed601595a70AB815c96711a31Bc65',
    sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  };
  
  const ERC20_ABI = [
    {
      name: 'balanceOf',
      type: 'function',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: 'balance', type: 'uint256' }],
    },
  ];
  
  export const getUSDCBalance: Provider = {
    name: 'USDCBalanceProvider',
    description: 'A provider for getting USDC balance',
  
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
      const balances: any[] = [];
  
      for (const chainName in chains) {
        const publicClient = walletProvider.getPublicClient(chainName as SupportedChain);
        if (!publicClient) {
          elizaLogger.warn(`No public client for chain ${chainName}`);
          continue;
        }

  
  
        // Try to fetch USDC balance if known
        const usdcAddress = USDC_ADDRESSES[chainName as SupportedChain];
        if (usdcAddress) {
          try {
            const usdcRaw = await publicClient.readContract({
              address: usdcAddress,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [address],
            });

            balances.push({
                chain: chainName,
                usdc: `${formatUnits(usdcRaw as bigint, 6)}`, 
            })

          } catch (err) {
            elizaLogger.warn(`Failed to fetch USDC on ${chainName}: ${err}`);
          }
        }
      }
  
      return {
        text: balances.map(
          b => `${b.chain}: ${b.usdc} USDC}`
        ).join(' | '),
        data: {
          address,
          balances,
        },
        values: {},
      };
    }
  };
  