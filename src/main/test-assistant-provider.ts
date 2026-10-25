import type { AssistantProviderPort } from '../application/ports/assistant-provider'
import type { CredentialProtectionPort } from '../application/ports/configuration'
import type { AssistantCandidatePayload, AssistantContextManifest } from '../contracts/assistant'
import type { AssistantConnectionTest } from '../contracts/assistant-service'

/** Explicit isolated Electron fixture; never selected by ordinary product configuration. */
export function createOfflineAssistantFixture(): {
  provider: AssistantProviderPort & {
    testConnection(signal?: AbortSignal): Promise<AssistantConnectionTest>
  }
  protection: CredentialProtectionPort
} | null {
  if (process.env.NODE_ENV !== 'test' || process.env.MYTRACER_E2E_ASSISTANT !== 'journey')
    return null
  return {
    protection: {
      protectionAvailability: () => 'available',
      protect: () => 'synthetic-ciphertext',
      unprotect: () => 'synthetic-fixture-key'
    },
    provider: {
      testConnection: async () => ({
        connection: 'connected',
        tools: 'unknown',
        streaming: 'unknown'
      }),
      complete: async (request) => {
        if (request.signal.aborted) throw new Error('cancelled')
        const manifest = JSON.parse(request.messages[1].content).context as AssistantContextManifest
        const current = manifest.sources[0].ref
        const input =
          request.messages.filter((message) => message.role === 'user').at(-1)?.content ?? ''
        if (input.includes('等待取消')) {
          await new Promise<void>((_, reject) =>
            request.signal.addEventListener('abort', () => reject(new Error('cancelled')), {
              once: true
            })
          )
        }
        if (
          input.includes('统计') &&
          !request.messages.some((message) => message.role === 'tool')
        ) {
          return {
            requestId: request.requestId,
            text: '',
            finishReason: 'tool_calls',
            toolCalls: [{ id: 'synthetic-stats', name: 'getStatistics', arguments: '{}' }]
          }
        }
        const payload: AssistantCandidatePayload =
          current.kind === 'goal'
            ? { kind: 'action-create', title: '用五分钟整理一小叠纸张' }
            : current.kind === 'review'
              ? {
                  kind: 'review-draft',
                  confirmedProgress: '已整理一部分纸张。',
                  mainObstacle: '还有一小叠需要分类。',
                  nextAdjustment: '下次只整理五分钟。'
                }
              : { kind: 'record-summary', text: '整理了桌面的一角，剩余纸张下次继续。' }
        return {
          requestId: request.requestId,
          finishReason: 'stop',
          toolCalls: [],
          text: JSON.stringify({
            text: '合成演示：可以先从一小叠纸张开始；这只是候选，尚未保存。',
            sourceRefs: [current],
            candidates: [{ target: current, sourceRefs: [current], payload }]
          })
        }
      }
    }
  }
}
