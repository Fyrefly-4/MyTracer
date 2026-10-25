// Synthetic reporter fixtures test the adapter, not Electron behavior.
export function focusReportFixture(repeat = 3) {
  let id = 0
  const suites = ['goal-content-draft.e2e.test.ts', 'routine-content-draft.e2e.test.ts'].map(
    (file, index) => ({
      title: file,
      file,
      specs: Array.from({ length: (index === 0 ? 5 : 6) * repeat }, (_, n) => ({
        id: `synthetic-${id++}`,
        title: `scenario-${Math.floor(n / repeat)}`,
        file,
        line: Math.floor(n / repeat) + 1,
        column: 1,
        tests: [
          {
            projectId: '',
            expectedStatus: 'passed',
            status: 'expected',
            results: [{ status: 'passed', retry: 0, errors: [] }]
          }
        ]
      }))
    })
  )
  return {
    config: {
      forbidOnly: true,
      workers: 1,
      shard: null,
      projects: [{ repeatEach: repeat, retries: 0 }]
    },
    errors: [] as object[],
    suites,
    stats: { expected: 11 * repeat, unexpected: 0, skipped: 0, flaky: 0 }
  }
}
