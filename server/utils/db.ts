import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../db/schema'

const sqlite = new Database('server/db/qa-manager.db')
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS test_packs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    labels TEXT NOT NULL,
    description TEXT NOT NULL,
    documentation TEXT NOT NULL,
    adapter_id TEXT NOT NULL DEFAULT 'docker-pytest',
    configuration TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,
    output TEXT,
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS tests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_pack_id INTEGER NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    deleted_at INTEGER,
    image_version TEXT NOT NULL,
    node_id TEXT NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    suite TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (test_pack_id) REFERENCES test_packs (id) ON DELETE CASCADE
  )
`)

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS test_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    test_id INTEGER NOT NULL,
    job_id INTEGER,
    status TEXT NOT NULL,
    output TEXT,
    started_at INTEGER,
    finished_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL
  )
`)

const testPackColumns = sqlite.prepare('PRAGMA table_info(test_packs)').all() as Array<{ name: string }>
if (!testPackColumns.some(column => column.name === 'adapter_id')) {
  sqlite.exec('ALTER TABLE test_packs ADD COLUMN adapter_id TEXT NOT NULL DEFAULT "docker-pytest"')
}

const testsColumns = sqlite.prepare('PRAGMA table_info(tests)').all() as Array<{ name: string }>
if (!testsColumns.some(column => column.name === 'is_deleted')) {
  sqlite.exec('ALTER TABLE tests ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0')
}

if (!testsColumns.some(column => column.name === 'deleted_at')) {
  sqlite.exec('ALTER TABLE tests ADD COLUMN deleted_at INTEGER')
}

const hasLegacyTestsLayout = testsColumns.some(column => column.name === 'test_pack_image_id')
if (hasLegacyTestsLayout) {
  sqlite.exec('DROP TABLE IF EXISTS test_executions')
  sqlite.exec('DROP TABLE IF EXISTS tests')
  sqlite.exec(`
    CREATE TABLE tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_pack_id INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER,
      image_version TEXT NOT NULL,
      node_id TEXT NOT NULL,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      suite TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (test_pack_id) REFERENCES test_packs (id) ON DELETE CASCADE
    )
  `)

  sqlite.exec(`
    CREATE TABLE test_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      test_id INTEGER NOT NULL,
      job_id INTEGER,
      status TEXT NOT NULL,
      output TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE,
      FOREIGN KEY (job_id) REFERENCES jobs (id) ON DELETE SET NULL
    )
  `)
}

sqlite.exec('DROP TABLE IF EXISTS test_pack_images')
sqlite.exec('DROP TABLE IF EXISTS test_pack_versions')

export const db = drizzle(sqlite, { schema })
