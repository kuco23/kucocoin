import { ContractFactory, ZeroAddress, type Signer } from 'ethers'
import { abi as wEthAbi, bytecode as wEthBytecode } from "../artifacts/src/uniswapV2/test/WETH9.sol/WETH9.json"
import { abi as uniswapV2RouterAbi, bytecode as uniswapV2RouterBytecode } from "../artifacts/src/uniswapV2/UniswapV2Router.sol/UniswapV2Router.json"
import { abi as uniswapV2FactoryAbi, bytecode as uniswapV2FactoryBytecode } from "../artifacts/src/uniswapV2/UniswapV2Factory.sol/UniswapV2Factory.json"
import { abi as kucocoinAbi, bytecode as kucocoinBytecode } from '../artifacts/src/KucoCoin.sol/KucoCoin.json'
import { WETH9__factory, UniswapV2Factory__factory, UniswapV2Router__factory, KucoCoin__factory } from '../types'


export async function deployKucocoin(
  uniswapV2: string,
  investmentReturnBips: number,
  investmentDuration: bigint,
  retractFeeBips: number,
  retractDuration: bigint,
  signer: Signer
): Promise<string> {
  const factory = new ContractFactory(kucocoinAbi, kucocoinBytecode) as KucoCoin__factory
  const kucocoin = await factory.connect(signer).deploy(
    uniswapV2, investmentReturnBips, investmentDuration, retractFeeBips, retractDuration)
  await kucocoin.waitForDeployment()
  return kucocoin.getAddress()
}

export async function deployWETH9(
  signer: Signer
): Promise<string> {
  const factory = new ContractFactory(wEthAbi, wEthBytecode) as WETH9__factory
  const wEth = await factory.connect(signer).deploy()
  await wEth.waitForDeployment()
  return wEth.getAddress()
}

export async function deployUniswapV2Router(
  weth: string,
  signer: Signer
): Promise<string> {
  const factoryFactory = new ContractFactory(uniswapV2FactoryAbi, uniswapV2FactoryBytecode) as UniswapV2Factory__factory
  const factory = await factoryFactory.connect(signer).deploy(ZeroAddress)
  await factory.waitForDeployment()
  const routerFactory = new ContractFactory(uniswapV2RouterAbi, uniswapV2RouterBytecode) as UniswapV2Router__factory
  const router = await routerFactory.connect(signer).deploy(factory, weth)
  await router.waitForDeployment()
  return router.getAddress()
}