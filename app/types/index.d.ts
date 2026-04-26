import type { AvatarProps } from '@nuxt/ui'

export type UserStatus = 'subscribed' | 'unsubscribed' | 'bounced'
export type SaleStatus = 'paid' | 'failed' | 'refunded'

export interface User {
  id: number
  name: string
  email: string
  avatar?: AvatarProps
  status: UserStatus
  location: string
}

export interface Mail {
  id: number
  unread?: boolean
  from: User
  subject: string
  body: string
  date: string
}

export interface Member {
  name: string
  username: string
  role: 'member' | 'owner'
  avatar: AvatarProps
}

export interface Stat {
  title: string
  icon: string
  value: number | string
  variation: number
  formatter?: (value: number) => string
}

export interface Sale {
  id: string
  date: string
  status: SaleStatus
  email: string
  amount: number
}

export interface Notification {
  id: number
  unread?: boolean
  sender: User
  body: string
  date: string
}

export interface TestPack {
  id: number
  name: string
  labels: string[]
  description: string
  documentation: string
  adapterId: string
  configuration: Record<string, string>
  operations: Array<{
    id: string
    label: string
    description: string
    scope: 'test-pack' | 'test'
  }>
  state: {
    adapterId: string
    states: Array<{
      key: string
      label: string
      value: string
    }>
  }
  testsCount: number
  createdAt: string
  updatedAt: string
}

export interface AdapterDefinition {
  id: string
  label: string
  description: string
  configFields: Array<{
    key: string
    label: string
    type: 'text'
    placeholder?: string
    required?: boolean
  }>
  operations: Array<{
    id: string
    label: string
    description: string
    scope: 'test-pack' | 'test'
  }>
  states: Array<{
    key: string
    label: string
  }>
}

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export interface Job {
  id: number
  type: string
  status: JobStatus
  payload: string
  logs?: string
  output?: string
  error?: string
  attempts: number
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TestEntity {
  id: number
  testPackId: number
  imageVersion: string
  nodeId: string
  name: string
  path: string
  suite?: string
  createdAt: string
  updatedAt: string
}

export interface TestExecution {
  id: number
  testId: number
  jobId?: number
  testPackId: number
  nodeId: string
  name: string
  status: string
  output?: string
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

export type Period = 'daily' | 'weekly' | 'monthly'

export interface Range {
  start: Date
  end: Date
}
