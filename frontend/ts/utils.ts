import $ from 'jquery'

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

export function getUnixNow(): number {
  return Math.floor(Date.now() / 1000)
}

export function insideViewport(elt: JQuery<HTMLLIElement>): boolean {
  const top_of_element = elt.offset()!.top
  const bottom_of_element = elt.offset()!.top + elt.outerHeight()!
  const bottom_of_screen = $(window).scrollTop()! + $(window).innerHeight()!
  const top_of_screen = $(window).scrollTop()!
  return (bottom_of_screen > top_of_element) && (top_of_screen < bottom_of_element)
}