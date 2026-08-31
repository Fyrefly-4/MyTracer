import { describe, expect, it } from 'vitest'
import {
  InvalidStartHelpResponseError,
  validateStartHelpResponse
} from '../../src/application/ai-start-help'

let candidate = 0
const generateCandidateId = (): string => `candidate-${++candidate}`

const valid = () => ({
  acknowledgement: '开始困难很常见，我们只找一个很小的起点。',
  clarifyingQuestion: '哪一部分最难迈出第一步？',
  suggestions: [{ text: '先打开资料，只看标题。' }, { text: '给自己两分钟试试看。' }],
  understandingCandidates: [{ text: '目前阻力可能来自任务边界不清。' }],
  safetyNotes: ['合理休息也是可以的。'],
  providerRequestId: 'provider-request-1'
})

describe('validateStartHelpResponse', () => {
  it('normalizes a valid response and replaces every provider candidate identity', () => {
    const result = validateStartHelpResponse(valid(), 'request-1', generateCandidateId)
    expect(result).toMatchObject({
      requestId: 'request-1',
      acknowledgement: '开始困难很常见，我们只找一个很小的起点。',
      suggestions: [
        { candidateId: expect.stringMatching(/^candidate-/), text: '先打开资料，只看标题。' },
        { candidateId: expect.stringMatching(/^candidate-/), text: '给自己两分钟试试看。' }
      ]
    })
  })

  it.each([
    ['zero suggestions', { ...valid(), suggestions: [] }],
    ['more than three suggestions', { ...valid(), suggestions: Array(4).fill({ text: 'x' }) }],
    ['unknown root field', { ...valid(), raw: 'forbidden' }],
    ['provider candidate id', { ...valid(), suggestions: [{ candidateId: 'bad', text: 'x' }] }],
    ['blank text', { ...valid(), suggestions: [{ text: '   ' }] }],
    ['nested value', { ...valid(), suggestions: [{ text: { nested: true } }] }],
    ['html', { ...valid(), suggestions: [{ text: '<strong>do it</strong>' }] }],
    ['oversized item', { ...valid(), suggestions: [{ text: 'x'.repeat(501) }] }],
    ['oversized provider id', { ...valid(), providerRequestId: 'x'.repeat(129) }]
  ])('rejects %s as one invalid response', (_name, response) => {
    expect(() => validateStartHelpResponse(response, 'request-1', generateCandidateId)).toThrow(
      InvalidStartHelpResponseError
    )
  })
})
