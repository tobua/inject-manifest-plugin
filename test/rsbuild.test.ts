import { test, expect, beforeEach, afterEach, vi } from 'vitest'
import { registerVitest, environment, packageJson, prepare, file, readFile } from 'jest-fixture'
import { existsSync } from 'fs'
import { InjectManifestPlugin } from '../index'
import rsbuild from './rsbuild'
import { findManifest } from './helper'

// Test cases only for Rsbuild
registerVitest(beforeEach, afterEach, vi)

environment('rsbuild')

test('Basic example also works with Rsbuild.', async () => {
  prepare([
    packageJson('rsbuild'),
    file('index.js', 'console.log("hello world")'),
    file('service-worker.js', "console.log('worker', self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await rsbuild({
    source: {
      entry: {
        // TODO test with default entry.
        index: './index.js',
      },
    },
    output: {
      sourceMap: {
        js: false,
      },
    },
    tools: {
      rspack: {
        plugins: [new InjectManifestPlugin()],
      },
    },
  })

  expect(buildResult).toBe('success')
  expect(existsSync('dist/static/js/index.js'))

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
  expect(Object.keys(manifest).some((assetName) => assetName.includes('service-worker'))).toBe(
    false,
  )
})
