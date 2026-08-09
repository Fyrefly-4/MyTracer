import { contextBridge, ipcRenderer } from 'electron'
import { SHELL_STATUS_CHANNEL, type MyTracerApi, type ShellStatus } from '../contracts/shell'

const api: MyTracerApi = Object.freeze({
  shell: Object.freeze({
    getStatus: (): Promise<ShellStatus> => ipcRenderer.invoke(SHELL_STATUS_CHANNEL)
  })
})

contextBridge.exposeInMainWorld('myTracer', api)
