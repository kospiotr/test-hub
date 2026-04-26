# Test Pack Platform Documentation

This document summarizes what was implemented in the current session for the Test Pack, Images, Adapters, Jobs, and Tests platform.

## 1) Product Model

### Test Pack

A Test Pack defines a reusable container testing family and contains:

- `name`
- `labels`
- `description` (WYSIWYG markdown)
- `documentation` (WYSIWYG markdown)
- `configuration`:
  - `imageRegistry` (required)
  - `imageName` (required)
  - `collectAdapter` (required, collect-capable)
  - `runAdapter` (required, run-capable)

### Image

An Image belongs to a Test Pack and identifies a specific version.

- `testPackId`
- `version`
- computed image reference: `imageRegistry/imageName:version`
- runtime status from local Docker state:
  - `missing`
  - `pulled`

## 2) Adapters

Adapters are shipped with the app and registered in code.

File: `server/utils/adapters.ts`

Registered adapters:

- `pytest-collect` (mode: `collect`) command: `pytest --collect-only -q`
- `pytest-run` (mode: `run`) command: `pytest -q`

Adapter list API:

- `GET /api/adapters`

## 3) Queue + Worker

Queue is DB-backed via `jobs` table. A Nitro plugin starts an in-process worker loop.

- Plugin: `server/plugins/jobs-worker.ts`
- Worker core: `server/utils/jobs.ts`

Job lifecycle:

- `queued` -> `running` -> `succeeded` / `failed` / `cancelled`

Current worker polling interval is 1 second.

## 4) Job Types

Implemented job types:

- `load-tests`
  - pulls image if missing
  - runs collect adapter in Docker
  - parses discovered tests
  - replaces tests for that image

- `run-all-tests`
  - pulls image if missing
  - runs run adapter in Docker for entire suite
  - creates `test_executions` records linked to discovered tests

- `run-test`
  - pulls image if missing
  - runs run adapter in Docker scoped to one `nodeId`
  - creates one `test_execution`

Jobs API:

- `GET /api/jobs`
- `POST /api/jobs`

`POST /api/jobs` payload examples:

```json
{
  "type": "load-tests",
  "payload": { "testPackImageId": 12 }
}
```

```json
{
  "type": "run-all-tests",
  "payload": { "testPackImageId": 12 }
}
```

```json
{
  "type": "run-test",
  "payload": { "testId": 203 }
}
```

## 5) Test Discovery and Execution Data

### Tests

Discovered test entities are stored in `tests` table:

- `testPackImageId`
- `nodeId`
- `name`
- `path`
- `suite`

API:

- `GET /api/tests`
  - optional query: `testPackImageId`

### Test Executions

Execution records are stored in `test_executions` table:

- `testId`
- `jobId`
- `status`
- `output`
- timestamps

API:

- `GET /api/test-executions`
  - optional query: `testId`, `testPackImageId`

## 6) Docker Integration

Files:

- `server/utils/docker-images.ts`
- `server/utils/docker-runner.ts`

Capabilities:

- check local image availability with `docker image inspect`
- pull image via `docker pull`
- run container command via `docker run --rm <image> <command...>`

Image status shown in UI uses real local Docker state, not persisted status fields.

## 7) Database Tables

Current primary tables used by this feature:

- `test_packs`
- `test_pack_images`
- `jobs`
- `tests`
- `test_executions`

Schema source:

- `server/db/schema.ts`
- bootstrap/migrations: `server/utils/db.ts`

## 8) UI Structure

### Top-level pages

- `/test-packs` (general CRUD)
- `/test-packs/images` (image CRUD + Pull + Load Tests + Run All Tests actions)
- `/tests` (discovered tests + run actions + execution list)
- `/jobs` (job queue monitoring)

### Test Pack Form

Shared create/edit form:

- `app/components/test-packs/Form.vue`

Tabs:

- Summary
- Documentation
- Configuration

Configuration contains image registry/name and collect/run adapters.

## 9) Key Server Endpoints

- Test Packs:
  - `GET /api/test-packs`
  - `POST /api/test-packs`
  - `GET /api/test-packs/:id`
  - `PATCH /api/test-packs/:id`
  - `DELETE /api/test-packs/:id`

- Images:
  - `GET /api/test-pack-images`
  - `POST /api/test-pack-images`
  - `PATCH /api/test-pack-images/:id`
  - `DELETE /api/test-pack-images/:id`
  - `POST /api/test-pack-images/:id/pull`

- Platform:
  - `GET /api/adapters`
  - `GET /api/jobs`
  - `POST /api/jobs`
  - `GET /api/tests`
  - `GET /api/test-executions`

## 10) Current MVP Limitations

- Test output streaming is not yet persisted incrementally; output is stored after command completion.
- `run-all-tests` currently stores execution snapshots per linked test with shared output; per-test pass/fail parsing can be improved.
- Worker is in-process (good for single-instance MVP). Multi-instance deployments should move to a dedicated worker service.

## 11) Operational Commands

Useful local checks used during implementation:

- `npm run db:push`
- `npm run typecheck`
- `npm run build`
