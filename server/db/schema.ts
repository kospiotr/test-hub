import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
})

export const testPacks = sqliteTable('test_packs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  labels: text('labels').notNull(),
  description: text('description').notNull(),
  documentation: text('documentation').notNull(),
  adapterId: text('adapter_id').notNull(),
  configuration: text('configuration').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

export const jobs = sqliteTable('jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  status: text('status').notNull(),
  payload: text('payload').notNull(),
  output: text('output'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

export const tests = sqliteTable('tests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testPackId: integer('test_pack_id').notNull().references(() => testPacks.id, { onDelete: 'cascade' }),
  imageVersion: text('image_version').notNull(),
  nodeId: text('node_id').notNull(),
  name: text('name').notNull(),
  path: text('path').notNull(),
  suite: text('suite'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})

export const testExecutions = sqliteTable('test_executions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  testId: integer('test_id').notNull().references(() => tests.id, { onDelete: 'cascade' }),
  jobId: integer('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  status: text('status').notNull(),
  output: text('output'),
  startedAt: integer('started_at', { mode: 'timestamp_ms' }),
  finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull()
})
