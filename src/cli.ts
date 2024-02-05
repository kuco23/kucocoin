import { Command } from 'commander'
import { Wallet, ethers } from 'ethers'
import { abi as kucocoinAbi, bytecode as kucocoinBytecode } from '../artifacts/contracts/KucoCoin.sol/KucoCoin.json'
import { networkInfo } from './config'
import type { OptionValues } from 'commander'
import type { KucoCoin__factory } from '../types'


let provider: ethers.JsonRpcApiProvider
let signer: ethers.Wallet

const program = new Command("KucoCoin CLI")
program
  .option("-n, --network <costwo|flare|flarefork>", "network to use", "costwo")
  .option("-e, --env-file <env>", "env file to use", ".env")
  .hook("preAction", (cmd: Command) => {
    const options = cmd.opts()
    require('dotenv').config({ path: options.envFile })
    const ninfo = networkInfo[options.network]
    provider = new ethers.JsonRpcProvider(ninfo.rpc)
    signer = new Wallet(process.env.SIGNER_PRIVATE_KEY!, provider)
  })
program
  .command("deploy").description("deploy KucoCoin")
  .argument("initial liquidity", "initial liquidity deposited to the dex")
  .argument("investment return", "factor at which to return the investment value")
  .action(async (liquidity: string, investmentReturn: string, _options: OptionValues) => {
    const options = { ...program.opts(), ..._options }
    const ninfo = networkInfo[options.network]
    const kucocoinAddress = await deployKucocoin(ninfo.dex, BigInt(liquidity), parseInt(investmentReturn))
    console.log(`KucoCoin deployed at ${kucocoinAddress}`)
  })

program.parseAsync(process.argv).catch(err => {
  if (err instanceof Error) {
    console.log(`Error: ${err.message}`)
  }
})

async function deployKucocoin(
  dex: string,
  liquidity: bigint,
  investmentReturnBips: number
): Promise<string> {
  const factory = new ethers.ContractFactory(kucocoinAbi, kucocoinBytecode) as KucoCoin__factory
  const kucocoin = await factory.connect(signer).deploy(dex, liquidity, investmentReturnBips)
  await kucocoin.waitForDeployment()
  return kucocoin.getAddress()
}