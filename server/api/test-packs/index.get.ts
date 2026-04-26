import { desc } from 'drizzle-orm'
import { testPacks } from '../../db/schema'
import { db } from '../../utils/db'
import { mapTestPack } from '../../utils/test-packs'

export default defineEventHandler(async () => {
  const rows = await db.select().from(testPacks).orderBy(desc(testPacks.updatedAt))
  return Promise.all(rows.map(mapTestPack))
})
