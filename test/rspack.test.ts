import { test, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerVitest, environment, packageJson, prepare, file, readFile } from 'jest-fixture'
import { InjectManifestPlugin } from '../index'
import rspack from './rspack'
import { findManifest } from './helper'

// Test cases only for Rspack
registerVitest(beforeEach, afterEach, vi)

environment('rspack')

test('Worker file can be written in TypeScript.', async () => {
  prepare([
    packageJson('basic'),
    file('index.ts', 'console.log((5 + (60 as number)) as string)'),
    file('typed-worker.ts', "console.log('worker' as string, self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await rspack({
    entry: './index.ts',
    plugins: [new InjectManifestPlugin({ file: './typed-worker.ts' })],
  })

  expect(buildResult).toBe('success')

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
})
