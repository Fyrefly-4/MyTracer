const configured = ['RELEASE_APP_CLIENT_ID', 'RELEASE_APP_PRIVATE_KEY'].every(
  (name) => Boolean(process.env[name]?.trim())
)

if (!configured) {
  console.error(
    'release-app-not-configured: configure MYTRACER_RELEASE_APP_CLIENT_ID (Actions variable) and MYTRACER_RELEASE_APP_PRIVATE_KEY (Actions secret); see docs/maintenance/RELEASE.md. No GITHUB_TOKEN fallback.'
  )
  process.exitCode = 1
}
