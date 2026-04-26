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

type AdapterFieldMeta = {
  label?: string
  placeholder?: string
  type?: AdapterConfigField['type']
  required?: boolean
}

function humanizeFieldKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

export interface AdapterOperationContext {
  scope: AdapterOperationScope
  testPackId?: number
  testId?: number
  testIds?: number[]
  enqueue: (payload: { testPackId: number, operationId: string, testIds?: number[] }) => Promise<{ id: number }>
  appendLog: (message: string) => Promise<void>
}

export interface AdapterJobOperationContext {
  scope: AdapterOperationScope
  testPackId?: number
  testId?: number
  testIds?: number[]
  jobId?: number
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

export interface AdapterValidationContext {
  testPackId: number
}

export interface AdapterValidationCheckResult {
  key: string
  description: string
  status: 'ok' | 'error'
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
  abstract readonly configSchema: z.ZodType<TConfig>
  abstract readonly operations: AdapterOperationDefinition[]
  abstract readonly states: AdapterStateSupplier[]
  abstract runValidationChecks(context: AdapterValidationContext): Promise<AdapterValidationCheckResult[]>

  getConfigFields(): AdapterConfigField[] {
    if (!(this.configSchema instanceof z.ZodObject)) {
      throw new Error(`Adapter ${this.id} must use a Zod object schema for configuration.`)
    }

    const shape = this.configSchema.shape

    return Object.entries(shape).map(([key, schema]) => {
      const meta = (schema as z.ZodTypeAny).meta?.() as AdapterFieldMeta | undefined

      return {
        key,
        label: meta?.label || humanizeFieldKey(key),
        type: meta?.type || 'text',
        placeholder: meta?.placeholder,
        required: meta?.required ?? !schema.isOptional()
      }
    })
  }

  toManifest(): AdapterManifest {
    return {
      id: this.id,
      label: this.label,
      description: this.description,
      configFields: this.getConfigFields(),
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
