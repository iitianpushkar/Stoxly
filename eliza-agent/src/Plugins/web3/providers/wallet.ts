import {
    type IAgentRuntime,
    type Memory,
    type Provider,
    type ProviderResult,
    type State,
    elizaLogger,
    ServiceType,
    TEEMode,
} from '@elizaos/core';

import type {
    Account,
    Address,
    Chain,
    HttpTransport,
    PrivateKeyAccount,
    PublicClient,
    TestClient,
    WalletClient,
} from 'viem';

import {
    http,
    createPublicClient,
    createTestClient,
    createWalletClient,
    formatUnits,
    publicActions,
    walletActions,
  } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import * as viemChains from 'viem/chains';


const _SupportedChainList = Object.keys(viemChains) as Array<keyof typeof viemChains>;
export type SupportedChain = (typeof _SupportedChainList)[number];


export class WalletProvider{
  chains: Record<string, Chain> = {};
  account!: PrivateKeyAccount;
  runtime: IAgentRuntime;

  constructor(
    accountOrPrivateKey: PrivateKeyAccount | `0x${string}`,
    runtime: IAgentRuntime,
    chains?: Record<string, Chain>
    ) {
        this.setAccount(accountOrPrivateKey);
        if (chains) {
          this.chains = chains;
        }
        this.runtime = runtime;
}

private setAccount = (accountOrPrivateKey: PrivateKeyAccount | `0x${string}`) => {
    if (typeof accountOrPrivateKey === 'string') {
      this.account = privateKeyToAccount(accountOrPrivateKey);
    } else {
      this.account = accountOrPrivateKey;
    }
  };

  private createHttpTransport = (chainName: SupportedChain) => {
    const chain = this.chains[chainName];
    if (!chain) {
      throw new Error(`Chain not found: ${chainName}`);
    }
  
    if (chain.rpcUrls.custom) {
      return http(chain.rpcUrls.custom.http[0]);
    }
    return http(chain.rpcUrls.default.http[0]);
  };

  getAddress(): Address {
    return this.account.address;
  }

  getPublicClient(
    chainName: SupportedChain
  ): PublicClient<HttpTransport, Chain, Account | undefined> {
    const transport = this.createHttpTransport(chainName);

    const publicClient = createPublicClient({
      chain: this.chains[chainName],
      transport,
    });
    return publicClient;
  }

  getWalletClient(chainName: SupportedChain): WalletClient {
    const transport = this.createHttpTransport(chainName);

    const walletClient = createWalletClient({
      chain: this.chains[chainName],
      transport,
      account: this.account,
    });

    return walletClient;
  }

  static genChainFromName(chainName: string, customRpcUrl?: string | null): Chain {
    const baseChain = (viemChains as any)[chainName];

    if (!baseChain?.id) {
      throw new Error('Invalid chain name');
    }

    const viemChain: Chain = customRpcUrl
      ? {
          ...baseChain,
          rpcUrls: {
            ...baseChain.rpcUrls,
            custom: {
              http: [customRpcUrl],
            },
          },
        }
      : baseChain;

    return viemChain;
  }

}

const genChainsFromRuntime = (runtime: IAgentRuntime): Record<string, Chain> => {
    // Get chains from settings - ONLY use configured chains
    const configuredChains = (runtime?.character?.settings?.chains?.evm as SupportedChain[]) || [];
  
    // If no chains are configured, default to mainnet and base
    const chainsToUse = configuredChains.length > 0 ? configuredChains : ['mainnet', 'base'];
  
    if (!configuredChains.length) {
      elizaLogger.warn('No EVM chains configured in settings, defaulting to mainnet and base');
    }
  
    const chains: Record<string, Chain> = {};
  
    for (const chainName of chainsToUse) {
      try {
        // Try to get RPC URL from settings using different formats
        let rpcUrl = runtime.getSetting(`ETHEREUM_PROVIDER_${chainName.toUpperCase()}`);
  
        if (!rpcUrl) {
          rpcUrl = runtime.getSetting(`EVM_PROVIDER_${chainName.toUpperCase()}`);
        }
  
        // Skip chains that don't exist in viem
        if (!(viemChains as any)[chainName]) {
          elizaLogger.warn(`Chain ${chainName} not found in viem chains, skipping`);
          continue;
        }
  
        const chain = WalletProvider.genChainFromName(chainName, rpcUrl);
        chains[chainName] = chain;
        elizaLogger.log(`Configured chain: ${chainName}`);
      } catch (error) {
        elizaLogger.error(`Error configuring chain ${chainName}:`, error);
      }
    }
  
    return chains;
  };

export const initWalletProvider = async (runtime: IAgentRuntime) => {
  
    const chains = genChainsFromRuntime(runtime);

    const privateKey = runtime.getSetting('EVM_PRIVATE_KEY') as `0x${string}`;
    if (!privateKey) {
      throw new Error('EVM_PRIVATE_KEY is missing');
    }
    return new WalletProvider(privateKey, runtime, chains);
};

export const evmWalletProvider:Provider={
    name: 'evmWalletProvider',
    description: 'A provider for EVM wallet interactions',

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

        const agentName = state?.agentName || 'The agent'
        return {
            text: `${agentName} is ready to interact with the EVM wallet ${address}.`,
            values: {
                address: address,
                chains: Object.keys(walletProvider.chains),
            },
            data: {
                account: walletProvider.account,
                chains: Object.keys(walletProvider.chains),
            },
          };
    }
}