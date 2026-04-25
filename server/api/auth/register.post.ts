import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../db/schema'
import { db } from '../../utils/db'

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
})

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const payload = registerSchema.parse(body)
  const email = payload.email.toLowerCase()

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email)
  })

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'Email is already registered.' })
  }

  const passwordHash = await hashPassword(payload.password)

  const [created] = await db.insert(users).values({
    name: payload.name,
    email,
    passwordHash,
    createdAt: new Date()
  }).returning({
    id: users.id,
    name: users.name,
    email: users.email
  })

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create user account.' })
  }

  await setUserSession(event, {
    user: {
      id: String(created.id),
      name: created.name,
      email: created.email
    },
    loggedInAt: Date.now()
  })

  return { ok: true }
})
