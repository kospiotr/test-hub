import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'
import { db } from '../../utils/db'

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload = loginSchema.parse(body)

  const account = await db.query.users.findFirst({
    where: eq(users.email, payload.email.toLowerCase())
  })

  if (!account || !(await verifyPassword(account.passwordHash, payload.password))) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password.' })
  }

  await setUserSession(event, {
    user: {
      id: String(account.id),
      name: account.name,
      email: account.email
    },
    loggedInAt: Date.now()
  })

  return { ok: true }
})
