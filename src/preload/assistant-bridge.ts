import { ASSISTANT_CHANNELS, type AssistantApi } from '../contracts/assistant'
import {
  ASSISTANT_SERVICE_CHANNELS,
  type AssistantServiceApi
} from '../contracts/assistant-service'

/** Concrete methods only: no renderer-controlled channel is exposed. */
export function createAssistantBridge(ipc: {
  invoke(channel: string, ...args: unknown[]): Promise<unknown>
}): {
  readonly assistant: AssistantApi
  readonly assistantService: AssistantServiceApi
} {
  const assistant = Object.freeze<AssistantApi>({
    createSession: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.createSession, input) as ReturnType<
        AssistantApi['createSession']
      >,
    listSessions: () =>
      ipc.invoke(ASSISTANT_CHANNELS.listSessions) as ReturnType<AssistantApi['listSessions']>,
    getSession: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.getSession, input) as ReturnType<AssistantApi['getSession']>,
    deleteSession: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.deleteSession, input) as ReturnType<
        AssistantApi['deleteSession']
      >,
    setScope: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.setScope, input) as ReturnType<AssistantApi['setScope']>,
    sendTurn: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.sendTurn, input) as ReturnType<AssistantApi['sendTurn']>,
    getRun: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.getRun, input) as ReturnType<AssistantApi['getRun']>,
    cancelTurn: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.cancelTurn, input) as ReturnType<AssistantApi['cancelTurn']>,
    previewWrite: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.previewWrite, input) as ReturnType<
        AssistantApi['previewWrite']
      >,
    confirmWrite: (input) =>
      ipc.invoke(ASSISTANT_CHANNELS.confirmWrite, input) as ReturnType<AssistantApi['confirmWrite']>
  })
  const assistantService = Object.freeze<AssistantServiceApi>({
    getStatus: () =>
      ipc.invoke(ASSISTANT_SERVICE_CHANNELS.getStatus) as ReturnType<
        AssistantServiceApi['getStatus']
      >,
    saveConfiguration: (input) =>
      ipc.invoke(ASSISTANT_SERVICE_CHANNELS.saveConfiguration, input) as ReturnType<
        AssistantServiceApi['saveConfiguration']
      >,
    deleteCredential: () =>
      ipc.invoke(ASSISTANT_SERVICE_CHANNELS.deleteCredential) as ReturnType<
        AssistantServiceApi['deleteCredential']
      >,
    testConnection: () =>
      ipc.invoke(ASSISTANT_SERVICE_CHANNELS.testConnection) as ReturnType<
        AssistantServiceApi['testConnection']
      >
  })
  return { assistant, assistantService }
}
