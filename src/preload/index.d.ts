declare global {
  interface Window {
    api: {
      invocar: (canal: string, ...args: unknown[]) => Promise<unknown>
    }
  }
}

export {}
