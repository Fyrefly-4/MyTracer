import { UpdatePortError, type UpdatePort } from '../application/ports/update'

export function createOfflineTestUpdatePort(currentVersion: string): UpdatePort | null {
  if (process.env.NODE_ENV !== 'test') return null
  const scenario = process.env.MYTRACER_E2E_UPDATE_SCENARIO
  if (
    !['available', 'authentication', 'network', 'invalid-metadata', 'timeout'].includes(
      scenario ?? ''
    )
  ) {
    return null
  }
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(currentVersion)
  if (!parts) return null
  const nextVersion = `${parts[1]}.${parts[2]}.${Number(parts[3]) + 1}`
  return {
    check: async (signal) => {
      if (scenario === 'authentication') throw new UpdatePortError('authentication')
      if (scenario === 'network') throw new UpdatePortError('network')
      if (scenario === 'invalid-metadata') throw new UpdatePortError('invalid-metadata')
      if (scenario === 'timeout') {
        await new Promise<void>((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new UpdatePortError('cancelled')), {
            once: true
          })
        })
      }
      return {
        version: nextVersion,
        releaseNotes: '<script>window.__updateAttack = true</script>更新说明',
        download: async (downloadSignal, onProgress) => {
          onProgress(50)
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 100)
            downloadSignal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer)
                reject(new UpdatePortError('cancelled'))
              },
              { once: true }
            )
          })
          onProgress(100)
        }
      }
    }
  }
}
