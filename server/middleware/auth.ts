const PUBLIC_PATH_PREFIXES = ['/api/auth/', '/api/_auth/']

export default defineEventHandler(async (event) => {
  const path = event.path || '/'

  if (!path.startsWith('/api/')) {
    return
  }

  if (PUBLIC_PATH_PREFIXES.some(prefix => path.startsWith(prefix))) {
    return
  }

  await requireUserSession(event)
})
