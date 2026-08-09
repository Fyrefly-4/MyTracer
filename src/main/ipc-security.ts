import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'

export interface RendererLocation {
  readonly developmentUrl?: string
  readonly productionUrl: string
}

export function isTrustedRendererUrl(candidate: string, location: RendererLocation): boolean {
  if (candidate === location.productionUrl) {
    return true
  }

  if (!location.developmentUrl) {
    return false
  }

  try {
    const candidateUrl = new URL(candidate)
    const trustedDevelopmentUrl = new URL(location.developmentUrl)
    return (
      candidateUrl.origin === trustedDevelopmentUrl.origin &&
      candidateUrl.pathname === trustedDevelopmentUrl.pathname
    )
  } catch {
    return false
  }
}

export function assertTrustedSender(
  event: IpcMainInvokeEvent,
  expectedWindow: BrowserWindow | null,
  location: RendererLocation
): void {
  const senderFrameUrl = event.senderFrame?.url

  if (
    !expectedWindow ||
    event.sender.id !== expectedWindow.webContents.id ||
    typeof senderFrameUrl !== 'string' ||
    !isTrustedRendererUrl(senderFrameUrl, location)
  ) {
    throw new Error('Rejected IPC request from an untrusted renderer.')
  }
}
