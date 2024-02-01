const costwo = {
  chainName: 'Coston2',
  chainId: "0x72",
  nativeCurrency: {
    name: 'C2FLR',
    decimals: 18,
    symbol: 'C2FLR'
  },
  rpcUrls: ['https://coston2-api.flare.network/ext/C/rpc'],
  blockExplorerUrls: ['https://coston2-explorer.flare.network']
}

const flarefork = {
  chainName: 'Flare Fork',
  chainId: '0x7a69',
  nativeCurrency: {
    name: 'FlareFork',
    decimals: 18,
    symbol: 'FLORK'
  },
  rpcUrls: ['http://127.0.0.1:8545']
}

export const network = flarefork

export const kucocoin = {
  address: "0xb831BEe70742FbFdD5Bfe8Fa52077D7d69623475",
  symbol: "KUCO",
  decimals: 18,
  abi: [
    {
      "inputs": [],
      "name": "getPoolReserves",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "_receiver",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "_minKuco",
          "type": "uint256"
        }
      ],
      "name": "buy",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "account",
          "type": "address"
        }
      ],
      "name": "balanceOf",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
  ]
}

kucocoin.address = '0x6617576633D5529aBeFDd7663F3bcd24B51EE20c'