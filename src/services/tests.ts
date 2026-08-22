import pb from '@/lib/pocketbase/client'

export interface TestResult {
  test: string
  role: string
  collection: string
  httpStatus: number
  expectedRecords: number | Array<{ id: string; titulo: string; inativo: boolean }>
  actualTotalItems: number
  actualItems: Array<{ id: string; titulo: string; inativo: boolean }>
  pass: boolean
  scope?: string
  expectedCount?: number
  inactiveExcluded?: boolean
}

export interface TestSummary {
  totalTests: number
  passed: number
  failed: number
  allPassed: boolean
}

export interface PositiveTestResults {
  generatedAt: string
  tests: TestResult[]
  summary: TestSummary
}

export const runPositiveTests = (): Promise<PositiveTestResults> =>
  pb.send('/backend/v1/run-positive-tests', { method: 'POST' })
