import { readFileSync, realpathSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import type { CredentialProtectionPort } from '../application/ports/configuration'
import type { AssistantCandidatePayload, AssistantContextManifest } from '../contracts/assistant'

/** Explicit isolated Electron fixture. Production still constructs the real OpenAI adapter. */
export function createOfflineAssistantFixture(launch: {
  isPackaged: boolean
  userDataPath: string
  testRoot: string
  cwd: string
}): {
  fetcher: typeof fetch
  protection: CredentialProtectionPort
} | null {
  // Environment variables alone must never replace OS credential protection.
  if (
    launch.isPackaged ||
    process.env.NODE_ENV !== 'test' ||
    process.env.MYTRACER_E2E_ASSISTANT !== 'journey' ||
    !launch.testRoot
  )
    return null
  try {
    const root = realpathSync(launch.testRoot)
    if (
      root !== resolve(launch.testRoot) ||
      !basename(root).startsWith('mytracer-tests-') ||
      realpathSync(launch.cwd) !== root ||
      realpathSync(launch.userDataPath) !== join(root, 'electron-user-data') ||
      readFileSync(join(root, '.assistant-synthetic-test'), 'utf8') !== 'isolated-synthetic-only'
    )
      return null
  } catch {
    return null
  }
  const reply = (
    text: string | null,
    tools?: readonly { id: string; name: string; arguments: string }[]
  ): Response =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              role: 'assistant',
              content: text,
              ...(tools
                ? {
                    tool_calls: tools.map(({ id, name, arguments: args }) => ({
                      id,
                      type: 'function',
                      function: { name, arguments: args }
                    }))
                  }
                : {})
            },
            finish_reason: tools ? 'tool_calls' : 'stop'
          }
        ]
      })
    )
  return {
    protection: {
      protectionAvailability: () => 'available',
      protect: () => 'synthetic-ciphertext',
      unprotect: () => 'synthetic-fixture-key'
    },
    fetcher: async (url, options) => {
      if (url !== 'https://example.invalid/v1/chat/completions')
        throw new Error('Unexpected synthetic endpoint')
      if (options?.signal?.aborted) throw new Error('cancelled')
      const body = JSON.parse(String(options?.body)) as {
        messages: { role: string; content: string }[]
      }
      if (body.messages.length === 1 && body.messages[0].content === 'Reply OK.') return reply('OK')
      const manifest = JSON.parse(body.messages[1].content).context as AssistantContextManifest
      const current = manifest.sources[0].ref
      const input = body.messages.filter((message) => message.role === 'user').at(-1)?.content ?? ''
      if (input.includes('等待取消')) {
        await new Promise<void>((_, reject) =>
          options?.signal?.addEventListener('abort', () => reject(new Error('cancelled')), {
            once: true
          })
        )
      }
      if (input.includes('统计') && !body.messages.some((message) => message.role === 'tool')) {
        return reply(null, [{ id: 'synthetic-stats', name: 'getStatistics', arguments: '{}' }])
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
      return reply(
        JSON.stringify({
          text: '合成演示：可以先从一小叠纸张开始；这只是候选，尚未保存。',
          sourceRefs: [current],
          candidates: [{ target: current, sourceRefs: [current], payload }]
        })
      )
    }
  }
}
