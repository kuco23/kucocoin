// exact liquidity to be deposited
export function optimalAddedLiquidity(
  addedA: bigint,
  addedB: bigint,
  reserveA: bigint,
  reserveB: bigint
): [bigint, bigint] {
  const exactAddedA = addedB * reserveA / reserveB
  if (exactAddedA <= addedA) {
    return [exactAddedA, addedB]
  } else {
    const exactAddedB = addedA * reserveB / reserveA
    return [addedA, exactAddedB]
  }
}

export function swapOutput(
  reserveA: bigint,
  reserveB: bigint,
  amountA: bigint
): bigint {
  const amountAWithFee = BigInt(997) * amountA
  const numerator = amountAWithFee * reserveB
  const denominator = BigInt(1000) * reserveA + amountAWithFee
  return numerator / denominator
}

export function rewardKucoFromInvestedNat(
  investedNat: bigint,
  reserveKuco: bigint,
  reserveNat: bigint,
  investmentReturnBips: number
): bigint {
  return applyBips(investedNat * reserveKuco, investmentReturnBips) / reserveNat
}

export function retractedNatFromInvestedNat(
  investedNat: bigint,
  retractFeeBips: number
): bigint {
  return applyBips(investedNat, 10_000 - retractFeeBips)
}

export function investmentFromKucoClaim(
  reserveKuco: bigint,
  reserveNat: bigint,
  amountKuco: bigint,
  rewardRatioBips: number
): bigint {
  const a = BigInt(2) * reserveNat * amountKuco
  const b = applyBips(reserveKuco * reserveNat, rewardRatioBips)
  const c = sqrt(
    applyBips(
      reserveKuco
      * reserveNat
      * reserveNat
      * (applyBips(reserveKuco, rewardRatioBips) - BigInt(4) * amountKuco),
      rewardRatioBips
    )
  )
  return (b - a + c) / (BigInt(2) * amountKuco)
}

// Helper functions

function sqrt(value: bigint): bigint {
  if (value < BigInt(0)) throw Error()
  if (value < BigInt(2)) return value
  function newtonIteration(n: bigint, x0: bigint): bigint {
      const x1 = ((n / x0) + x0) >> BigInt(1)
      if (x0 === x1 || x0 === (x1 - BigInt(1)))
          return x0
      return newtonIteration(n, x1)
  }
  return newtonIteration(value, BigInt(1))
}

function applyBips(value: bigint, ratio: number): bigint {
  return value * BigInt(ratio) / BigInt(10_000)
}