# Test Run Operations Spec

This spec defines the next incremental delivery for running tests through adapters on **test scope** (not test-pack scope).

## Goal

Enable adapters that support test execution to expose a test-scope operation (e.g. `run-tests`) that:

- accepts a list of test IDs
- creates a queue job
- executes one process per job
- streams command output into the job log in real time
- stores execution results in `test_executions` linked to both test and job

The implementation should be delivered in small, verifiable steps.

## Current Baseline

- Jobs are queue-based (`jobs` table) and processed by worker loop.
- Job logs are file-backed and streamed on job details page.
- Adapters support test-pack scoped operations and `runInJob` handlers.
- `test_executions` table exists and already references `test_id` and optional `job_id`.

## Scope

In scope:

- Add test-scope run operations to:
  - `docker-pytest`
  - `local-pytest`
- Queue + worker support for payload containing test ID list.
- Real-time streaming of command output to job logs while command runs.
- Persist `test_executions` rows per test with status and `jobId` linkage.
- Add dedicated Test Executions UI view.

Out of scope (for now):

- Parallel execution workers per test inside one job.
- Retries and flaky-test handling.
- Rich parser matrix per framework.
- Historical migration/backfill.

## Functional Requirements

### 1) Adapter contract: test-scope operation

- Operation scope `test` must be supported by adapter definitions.
- New operation id recommendation: `run-tests`.
- Operation request context must include `testIds: number[]`.
- Operation `run` should enqueue job; operation `runInJob` should perform actual execution.

### 2) Job payload and dispatch

- Job payload must support:
  - `testPackId: number`
  - `operationId: string`
  - `testIds?: number[]`
- Worker dispatch must forward `testIds` to adapter `runInJob` context.

### 3) One process per job

- For a given queued `run-tests` job, execute one process invocation.
- The command receives selected tests in one call (adapter-specific argument formatting).

### 4) Command source in config

- The command used for test run must come from adapter configuration.
- Add run command fields to adapter config where needed.
- Keep collect command behavior intact.

### 5) Real-time logs

- Command stdout/stderr must be streamed to job log file while process is running.
- Log lines should be prefixed with stream source (`[stdout]`/`[stderr]`).
- Job detail page should continue to stream this output via SSE.

### 6) Test execution persistence

- For each requested test:
  - create a `test_executions` record linked to `testId` and `jobId`
  - set start/end timestamps
  - set final status (`passed`/`failed` or equivalent normalized status)
  - persist relevant output (optional summarized output per test)

### 7) Status detection

- Adapter should derive per-test status from command output when possible.
- If parser cannot determine status for a test, fallback to process exit code semantics.

### 8) UI

- Tests list should expose a Run action that triggers test-scope operation.
- Dedicated Test Executions page should list persisted executions.
- Execution row should link to job details (for log inspection).

## Non-Functional Requirements

- Type-safe payload validation via Zod.
- No legacy compatibility layer required.
- Keep implementation adapter-driven (no hardcoded adapter branching in worker dispatcher).
- Maintain readable logs and clear failure reasons.

## Data Model Notes

Current `test_executions` schema is sufficient for MVP:

- `test_id`
- `job_id`
- `status`
- `output`
- `started_at`
- `finished_at`

Potential future additions (not required now):

- `duration_ms`
- `error`
- `raw_result_json`

## API Changes (Planned)

- `POST /api/tests/operations/:operationId`
  - body: `{ testIds: number[] }`
  - behavior: resolve corresponding test pack, enqueue adapter-operation job
- Existing jobs endpoints remain.
- Existing `GET /api/test-executions` used by new page.

## Task Breakdown

### Phase 1 - Contract and Queue

1. Extend adapter operation context to include `testIds` for test scope.
2. Extend job payload schema and parser to accept optional `testIds`.
3. Ensure worker passes `testIds` into adapter `runInJob`.
4. Add API endpoint to enqueue test-scope operations.

Acceptance:

- A test-scope operation can be enqueued with multiple test IDs.

### Phase 2 - Adapter implementations

1. Add `run-tests` operation to `docker-pytest` and `local-pytest`.
2. Add adapter config field(s) for run command.
3. Implement one-process execution using selected test list.
4. Stream stdout/stderr lines to `appendLog` while running.

Acceptance:

- Job logs show command output in real time during execution.

### Phase 3 - Execution persistence

1. Create/finish `test_executions` rows for each test in request.
2. Link each execution to `jobId`.
3. Implement per-test status mapping from output + fallback strategy.

Acceptance:

- Each requested test has an execution record after job completion.

### Phase 4 - UI delivery

1. Wire Run action from tests list to test-scope operation API.
2. Create dedicated Test Executions page.
3. Add job deep-link from execution rows.

Acceptance:

- User can run selected test and inspect execution + logs.

## Risks / Open Questions

- Output parsing reliability differs by adapter and command format.
- If mixed test packs are sent in one request, server must reject or split; MVP should reject with clear error.
- Command injection risk for configurable shell commands should be documented and constrained where possible.

## Definition of Done

- Both `docker-pytest` and `local-pytest` support queued test-scope run operation.
- Logs stream live while running.
- `test_executions` are persisted and linked to jobs.
- Dedicated Test Executions page is available.
- Typecheck/build pass.
