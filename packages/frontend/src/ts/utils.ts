import $ from 'jquery'
import { formatUnits } from 'ethers'


declare const window: any

export async function setImmediateAsyncInterval(func: () => Promise<any>, ms: number): Promise<NodeJS.Timeout> {
  await func()
  return setInterval(func, ms)
}

export function setImmediateSyncInterval(func: () => any, ms: number): NodeJS.Timeout {
  func()
  return setInterval(func, ms)
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getMsUnixNow(offset?: number): number {
  return Math.floor(Date.now()) + (offset ?? 0)
}

export function formatUnitsTruncate(amount: bigint, decimals: number, showDecimals: number): string {
  const formatted = formatUnits(amount, decimals)
  const seperator = formatted.includes(',') ? ',' : '.'
  if (!formatted.includes(seperator)) return formatted
  const [whole, fraction] = formatted.split(seperator)
  const fractionTruncated = fraction.slice(0, showDecimals)
  if (Number(fractionTruncated) == 0) return whole
  return `${whole}${seperator}${fractionTruncated}`
}

export function formatUnixDate(unix: number): string {
  const date = new Date(1000 * unix)
  const options = {
    year: 'numeric',
    month: 'long',
    day: '2-digit'
  } as { year: "numeric", month: "long", day: "2-digit" }
  return date.toLocaleDateString('en-US', options);
}

export function insideViewport(elt: JQuery<any>): boolean {
  const top_of_element = elt.offset()!.top
  const bottom_of_element = elt.offset()!.top + elt.outerHeight()!
  const bottom_of_screen = $(window).scrollTop()! + $(window).innerHeight()!
  const top_of_screen = $(window).scrollTop()!
  return (bottom_of_screen > top_of_element) && (top_of_screen < bottom_of_element)
}