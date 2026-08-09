/// <reference types="vite/client" />

import type { MyTracerApi } from '../../contracts/shell'

declare global {
  interface Window {
    readonly myTracer: MyTracerApi
  }
}

export {}
