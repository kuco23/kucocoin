export function setImmediateInterval(func: () => Promise<any>, interval: number): void {
  func().then(() => setInterval(func, interval))
}

export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}