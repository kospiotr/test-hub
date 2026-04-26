import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { testPacks } from '../../db/schema'

export type AdapterOperationScope = 'test-pack' | 'test'

export interface AdapterConfigField {
  key: string
  label: string
  type: 'text'
  placeholder?: string
  required?: boolean
}

export interface AdapterOperationContext {
  scope: AdapterOperationScope
  testPackId?: number
  testId?: number
  enqueue: (payload: { testPackId: number, operationId: string }) => Promise<{ id: number }>
  appendLog: (message: string) => Promise<void>
}

export interface AdapterJobOperationContext {
  scope: AdapterOperationScope
  testPackId?: number
  testId?: number
  appendLog: (message: string) => Promise<void>
}

export interface AdapterResolvedContext<TConfig extends Record<string, unknown>> {
  testPack: typeof testPacks.$inferSelect
  config: TConfig
}

export interface AdapterOperationDefinition {
  id: string
  label: string
  description: string
  scope: AdapterOperationScope
  run: (context: AdapterOperationContext) => Promise<{
    operationId: string
    mode: 'sync' | 'job'
    message: string
    jobId?: number
  }>
  runInJob?: (context: AdapterJobOperationContext) => Promise<unknown>
}

export interface AdapterStateSupplierContext {
  testPackId: number
}

export interface AdapterStateSupplier {
  key: string
  label: string
  supply: (context: AdapterStateSupplierContext) => Promise<string>
}

export interface AdapterStateValue {
  key: string
  label: string
  value: string
}

export interface AdapterManifest {
  id: string
  label: string
  description: string
  configFields: AdapterConfigField[]
  operations: Array<Pick<AdapterOperationDefinition, 'id' | 'label' | 'description' | 'scope'>>
  states: Array<Pick<AdapterStateSupplier, 'key' | 'label'>>
}

export abstract class AdapterInstance<TConfig extends Record<string, unknown>> {
  abstract readonly id: string
  abstract readonly label: string
  abstract readonly description: string
  abstract readonly configFields: AdapterConfigField[]
  abstract readonly configSchema: z.ZodType<TConfig>
  abstract readonly operations: AdapterOperationDefinition[]
  abstract readonly states: AdapterStateSupplier[]

  toManifest(): AdapterManifest {
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      configFields: this.configFields,
      operations: this.operations.map(({ id, label, description, scope }) => ({ id, label, description, scope })),
      states: this.states.map(({ key, label }) => ({ key, label }))
    }
  }

  parseConfig(rawConfig: unknown) {
    return this.configSchema.parse(rawConfig)
  }

  async resolveContext(testPackId: number): Promise<AdapterResolvedContext<TConfig>> {
    const testPack = await db.query.testPacks.findFirst({
      where: eq(testPacks.id, testPackId)
    })

    if (!testPack) {
      throw createError({ statusCode: 404, statusMessage: 'Test pack not found.' })
    }

    if (testPack.adapterId !== this.id) {
      throw createError({ statusCode: 400, statusMessage: `Test pack is configured with adapter ${testPack.adapterId}.` })
    }

    const rawConfig = JSON.parse(testPack.configuration) as unknown
    const config = this.parseConfig(rawConfig)

    return {
      testPack,
      config
    }
  }

  getOperationById(operationId: string) {
    return this.operations.find(operation => operation.id === operationId)
  }
}
