import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AssistantServiceConfigurationStore,
  ASSISTANT_CONFIGURATION_RELATIVE_PATH
} from '../../src/infrastructure/configuration/assistant-service-configuration'
import { createAssistantCredentialProtection } from '../../src/infrastructure/credentials/assistant-credential-protection'
import { OpenAiAssistantProvider } from '../../src/infrastructure/ai/assistant-openai-provider'
import type { AssistantProviderRequest } from '../../src/application/ports/assistant-provider'
import { registerAssistantServiceIpc } from '../../src/main/assistant-service-ipc'
import { ASSISTANT_SERVICE_CHANNELS } from '../../src/contracts/assistant-service'
import type { IpcMainInvokeEvent } from 'electron'

const roots: string[] = []
afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }))
  vi.useRealTimers()
})
const key = 'synthetic-test-secret'
function store(available = true, syntheticCredential = key) {
  const root = mkdtempSync(join(tmpdir(), 'assistant-config-'))
  roots.push(root)
  // Test double deliberately avoids writing any reversible plaintext credential.
  const protection = {
    protectionAvailability: () => (available ? ('available' as const) : ('unavailable' as const)),
    protect: () => {
      if (!available) throw Error(key)
      return 'fake-ciphertext'
    },
    unprotect: () => {
      if (!available) throw Error(key)
      return syntheticCredential
    }
  }
  return {
    root,
    protection,
    config: new AssistantServiceConfigurationStore({
      userDataPath: root,
      credentialProtection: protection
    })
  }
}
const settings = {
  endpoint: 'https://example.invalid/v1',
  model: 'test-model',
  enabled: true,
  apiKey: key
}
function request(signal = new AbortController().signal): AssistantProviderRequest {
  return {
    requestId: 'test-id',
    signal,
    messages: [{ role: 'user', content: 'synthetic note' }],
    budget: { timeoutMs: 1000, maxOutputTokens: 64, maxResponseBytes: 4096 }
  }
}
function reply(message: unknown = { role: 'assistant', content: 'OK' }, finish = 'stop') {
  return new Response(JSON.stringify({ choices: [{ message, finish_reason: finish }] }))
}
function provider(fetcher = vi.fn<typeof fetch>(async () => reply())) {
  const { config } = store()
  config.saveConfiguration(settings)
  return { api: new OpenAiAssistantProvider(config, fetcher), fetcher }
}

describe('assistant configuration', () => {
  it('protects keys, reloads settings, clears credentials when endpoint changes and deletes', () => {
    const { config, root } = store()
    expect(config.getStatus().credentialPresent).toBe(false)
    expect(config.saveConfiguration(settings).credentialPresent).toBe(true)
    expect(JSON.stringify(config.getStatus())).not.toContain(key)
    expect(readFileSync(join(root, ASSISTANT_CONFIGURATION_RELATIVE_PATH), 'utf8')).not.toContain(
      key
    )
    config.saveConfiguration({ ...settings, model: 'updated', apiKey: undefined })
    expect(config.readForRequest().apiKey).toBe(key)
    config.saveConfiguration({
      ...settings,
      endpoint: 'https://different.invalid/v1',
      apiKey: undefined
    })
    expect(config.getStatus().credentialPresent).toBe(false)
    config.saveConfiguration(settings)
    config.deleteCredential()
    expect(config.getStatus()).toMatchObject({ enabled: false, credentialPresent: false })
    expect(() => config.readForRequest()).toThrow('not-configured')
  })
  it('restores only encrypted configuration and keeps disabled service offline', async () => {
    const { config, root, protection } = store()
    config.saveConfiguration({ ...settings, enabled: false })
    const restored = new AssistantServiceConfigurationStore({
      userDataPath: root,
      credentialProtection: protection
    })
    expect(restored.getStatus()).toMatchObject({
      endpoint: settings.endpoint,
      model: settings.model,
      credentialPresent: true,
      enabled: false
    })
    const fetcher = vi.fn<typeof fetch>()
    await expect(
      new OpenAiAssistantProvider(restored, fetcher).complete(request())
    ).rejects.toThrow('disabled')
    expect(fetcher).not.toHaveBeenCalled()
    restored.deleteCredential()
    expect(config.getStatus().credentialPresent).toBe(false)
  })
  it('fails closed without protection and rejects Linux basic_text', () => {
    const { config } = store(false)
    expect(() => config.saveConfiguration(settings)).toThrow('storage-unavailable')
    expect(config.getStatus().credentialPresent).toBe(false)
    const protection = createAssistantCredentialProtection({
      isEncryptionAvailable: () => true,
      getSelectedStorageBackend: () => 'basic_text',
      encryptString: () => Buffer.from(key),
      decryptString: () => key
    })
    expect(() => protection.protect(key)).toThrow()
    expect(protection.protectionAvailability()).toBe('unavailable')
  })
  it.each([
    'http://localhost:4000/v1',
    'https://user:secret@example.invalid',
    'https://example.invalid/?key=secret',
    'https://example.invalid/#secret'
  ])('rejects unsafe endpoint %s', (endpoint) => {
    expect(() => store().config.saveConfiguration({ ...settings, endpoint })).toThrow(
      'invalid-configuration'
    )
  })
  it('does not import legacy settings and deletes malformed remnants', () => {
    const { config, root } = store()
    mkdirSync(join(root, 'configuration'))
    writeFileSync(
      join(root, 'configuration/ai-provider.v1.json'),
      JSON.stringify({ encryptedCredential: 'old' })
    )
    expect(config.getStatus().credentialPresent).toBe(false)
    writeFileSync(
      join(root, ASSISTANT_CONFIGURATION_RELATIVE_PATH),
      JSON.stringify({ ...settings, version: 0 })
    )
    expect(() => config.readForRequest()).toThrow('not-configured')
    config.deleteCredential()
    expect(readFileSync(join(root, 'configuration/ai-provider.v1.json'), 'utf8')).toContain('old')
  })
})
describe('assistant mock protocol', () => {
  it('sends Main messages with redirects forbidden and reports capability unknown', async () => {
    const { api, fetcher } = provider()
    expect(await api.complete(request())).toMatchObject({
      requestId: 'test-id',
      text: 'OK',
      toolCalls: []
    })
    expect(fetcher.mock.calls[0][0]).toBe('https://example.invalid/v1/chat/completions')
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', method: 'POST' })
    expect(await api.testConnection()).toEqual({
      connection: 'connected',
      streaming: 'unknown',
      tools: 'unknown'
    })
  })
  it('serializes tool history for subsequent bounded steps', async () => {
    const { api, fetcher } = provider()
    await api.complete({
      ...request(),
      messages: [
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call-1', name: 'findRecords', arguments: '{}' }]
        },
        { role: 'tool', content: 'synthetic result', toolCallId: 'call-1' }
      ],
      tools: [{ name: 'findRecords', description: 'Scoped query', parameters: { type: 'object' } }]
    })
    const body = JSON.parse(fetcher.mock.calls[0][1]!.body as string)
    expect(body.messages[0].tool_calls[0].function.name).toBe('findRecords')
    expect(body.messages[1].tool_call_id).toBe('call-1')
    expect(body.tools[0].type).toBe('function')
  })
  it('rejects escaped credential echoes after decoding', async () => {
    const encoded = JSON.stringify({
      choices: [{ message: { role: 'assistant', content: key }, finish_reason: 'stop' }]
    }).replace(
      key,
      Array.from(key)
        .map((c) => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('')
    )
    const { api } = provider(vi.fn(async () => new Response(encoded)))
    await expect(api.complete(request())).rejects.toThrow('protocol')
  })
  it.each([String.fromCharCode(34), String.fromCharCode(92)])(
    'rejects decoded credential echoes with JSON-special characters (%s)',
    async (special) => {
      const credential = `synthetic${special}credential`
      const { config } = store(true, credential)
      config.saveConfiguration({ ...settings, apiKey: credential })
      const unicode = Array.from(credential)
        .map((c) => String.fromCharCode(92) + 'u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('')
      const payloads = [
        { role: 'assistant', content: credential },
        { role: 'assistant', content: JSON.stringify({ value: credential }) },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'findRecords',
                arguments: JSON.stringify({ nested: [{ value: credential }] })
              }
            }
          ]
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: { name: 'findRecords', arguments: `{"query":"${unicode}"}` }
            }
          ]
        },
        {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call-1',
              type: 'function',
              function: {
                name: 'findRecords',
                arguments: JSON.stringify({ encoded: JSON.stringify({ value: credential }) })
              }
            }
          ]
        }
      ]
      for (const message of payloads) {
        const api = new OpenAiAssistantProvider(
          config,
          vi.fn(async () => reply(message, message.tool_calls ? 'tool_calls' : 'stop'))
        )
        await expect(api.complete(request())).rejects.toThrow(/^protocol$/)
      }
      const raw = `{"choices":[{"message":{"role":"assistant","content":"${unicode}"},"finish_reason":"stop"}]}`
      await expect(
        new OpenAiAssistantProvider(
          config,
          vi.fn(async () => new Response(raw))
        ).complete(request())
      ).rejects.toThrow(/^protocol$/)
    }
  )
  it.each([401, 500])(
    'cancels unread endless HTTP %s bodies and aborts transport',
    async (status) => {
      const cancel = vi.fn()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
        },
        cancel
      })
      const fetcher = vi.fn<typeof fetch>(async () => new Response(stream, { status }))
      const { api } = provider(fetcher)
      await expect(api.complete(request())).rejects.toThrow(
        status === 401 ? /^authentication$/ : /^network$/
      )
      expect(cancel).toHaveBeenCalledTimes(1)
      expect(fetcher.mock.calls[0][1]!.signal!.aborted).toBe(true)
    }
  )
  it('returns explicit tool proposals without executing them', async () => {
    const { api } = provider(
      vi.fn(async () =>
        reply(
          {
            role: 'assistant',
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                type: 'function',
                function: { name: 'findRecords', arguments: '{"query":"test"}' }
              }
            ]
          },
          'tool_calls'
        )
      )
    )
    expect((await api.complete(request())).toolCalls).toEqual([
      { id: 'call-1', name: 'findRecords', arguments: '{"query":"test"}' }
    ])
  })
  it.each([
    {},
    { choices: [] },
    { choices: [{ message: { role: 'user', content: 'bad' }, finish_reason: 'stop' }] },
    { choices: [{ message: { role: 'assistant', content: key }, finish_reason: 'stop' }] }
  ])('rejects malformed or credential-echo responses', async (value) => {
    const { api } = provider(vi.fn(async () => new Response(JSON.stringify(value))))
    await expect(api.complete(request())).rejects.toThrow('protocol')
  })
  it('redacts thrown network errors and authorization response bodies', async () => {
    const { api } = provider(
      vi.fn(async () => {
        throw Error(key)
      })
    )
    await expect(api.complete(request())).rejects.toThrow(/^network$/)
    const denied = provider(vi.fn(async () => new Response(key, { status: 401 })))
    await expect(denied.api.complete(request())).rejects.toThrow(/^authentication$/)
  })
  it('never calls transport without a credential', async () => {
    const fetcher = vi.fn<typeof fetch>()
    const api = new OpenAiAssistantProvider(store().config, fetcher)
    await expect(api.complete(request())).rejects.toThrow('not-configured')
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('bounds response size', async () => {
    const { api } = provider(
      vi.fn(async () => reply({ role: 'assistant', content: 'x'.repeat(5000) }))
    )
    await expect(api.complete(request())).rejects.toThrow('budget')
  })
  it('cancels and times out even if a transport ignores abort', async () => {
    vi.useFakeTimers()
    const { api } = provider(vi.fn(() => new Promise<Response>(() => {})))
    const abort = new AbortController()
    const pending = api.complete(request(abort.signal))
    abort.abort()
    await expect(pending).rejects.toThrow('cancelled')
    const timeout = expect(api.complete(request())).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(1000)
    await timeout
    await expect(api.complete(request(abort.signal))).rejects.toThrow('cancelled')
  })
})
it('IPC validates senders and inputs and never probes during status/save/delete', async () => {
  const handlers = new Map<string, (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown>()
  const { config } = store()
  const testConnection = vi.fn(async () => ({
    connection: 'connected' as const,
    tools: 'unknown' as const,
    streaming: 'unknown' as const
  }))
  const changed = vi.fn()
  const sender = {} as IpcMainInvokeEvent
  registerAssistantServiceIpc({
    ipc: {
      removeHandler: (channel) => {
        handlers.delete(channel)
      },
      handle: (channel, fn) => {
        handlers.set(channel, fn)
      }
    },
    configuration: config,
    provider: { testConnection },
    configurationChanged: changed,
    assertSender: (event) => {
      if (event !== sender) throw Error('denied')
    }
  })
  const call = (name: keyof typeof ASSISTANT_SERVICE_CHANNELS, ...args: unknown[]) =>
    handlers.get(ASSISTANT_SERVICE_CHANNELS[name])!(sender, ...args)
  await expect(
    handlers.get(ASSISTANT_SERVICE_CHANNELS.getStatus)!({} as IpcMainInvokeEvent)
  ).rejects.toThrow('denied')
  expect(await call('saveConfiguration', { ...settings, extra: key })).toMatchObject({
    ok: false,
    error: { code: 'invalid-configuration' }
  })
  await call('saveConfiguration', settings)
  expect(JSON.stringify(await call('getStatus'))).not.toContain(key)
  await call('deleteCredential')
  expect(changed).toHaveBeenCalledTimes(2)
  expect(testConnection).not.toHaveBeenCalled()
  await call('testConnection')
  expect(testConnection).toHaveBeenCalledTimes(1)
})
