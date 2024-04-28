const fuji = {
  metamask: {
    chainName: 'Fuji Network C-Chain',
    chainId: '0xa869',
    nativeCurrency: {
      name: 'FUJI',
      decimals: 18,
      symbol: 'FUJI'
    },
    rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc']
  },
  kucocoin: "0x6f587509C96c619D74454E8aE1734fB70DF62715",
  snowtrace: "https://testnet.snowtrace.io/address/0xEB7e0aB571A8d328123C790fAae38ac5cA1E8441/contract/43113/writeContract?chainId=43113",
  uniswap: "https://testnet.snowtrace.io/address/0xA9992b1Cc07C2338e325870ccFEE73127F3E2b71/contract/43113/writeContract?chainId=43113#F10"
}

const avalanche = {
  metamask: {
    chainName: 'Avalanche Network C-Chain',
    chainId: '0xa86a',
    nativeCurrency: {
      name: 'AVAX',
      decimals: 18,
      symbol: 'AVAX'
    },
    rpcUrls: ['https://avalanche-mainnet.infura.io']
  }
}

const avalanchefork = {
  metamask: {
    chainName: 'Avalanche Fork',
    chainId: '0x7a69',
    nativeCurrency: {
      name: 'AvalancheFork',
      decimals: 18,
      symbol: 'FAVAX'
    },
    rpcUrls: ['http://127.0.0.1:8545']
  }
}

export const NETWORK = fuji