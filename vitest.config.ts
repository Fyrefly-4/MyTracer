import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['default'],
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.test.ts']
        }
      },
      {
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          pool: 'forks',
          fileParallelism: false
        }
      }
    ]
  }
})
