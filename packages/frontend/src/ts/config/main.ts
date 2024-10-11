import { network } from "./network"
import { avalancheforkEip1193, fujiEip1193, avalancheEip1193 } from "./eip1193"
import { avalancheforkToken, fujiToken, avalancheToken } from "./token"

let eip1193 = avalancheEip1193
if (network === "fuji") {
  eip1193 = fujiEip1193
} else if (network === "avalanchefork") {
  eip1193 = avalancheforkEip1193
}

let token = avalancheToken
if (network === "fuji") {
  token = fujiToken
} else if (network === "avalanchefork") {
  token = avalancheforkToken
}

export const config = { eip1193, token }