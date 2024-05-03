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
    file('src/index.js', 'console.log("hello world")'),
    file('service-worker.js', "console.log('worker', self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await rsbuild({
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

  const indexContents = readFile('dist/static/js/index.js')

  expect(indexContents).toContain('"hello world"')

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
  expect(Object.keys(manifest).some((assetName) => assetName.includes('service-worker'))).toBe(
    false,
  )
})

test('Rsbuild works with TypeScript entry.', async () => {
  prepare([
    packageJson('rsbuild'),
    file(
      'index.ts',
      'import join from "url-join"; import { clientsClaim } from "workbox-core"; clientsClaim(); console.log(join("https://www.google.com", "android"), "hello world" as string)',
    ),
    file('service-worker.ts', "console.log('worker' as string, self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await rsbuild({
    source: {
      entry: {
        index: './index.ts',
      },
    },
    output: {
      sourceMap: {
        js: false,
      },
    },
    tools: {
      rspack: {
        plugins: [new InjectManifestPlugin({ file: './service-worker.ts' })],
      },
    },
  })

  expect(buildResult).toBe('success')
  expect(existsSync('dist/static/js/index.js'))

  const indexContents = readFile('dist/static/js/index.js')

  expect(indexContents).toContain('"hello world"')
  expect(indexContents).not.toContain('as string')

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(3)
  expect(Object.keys(manifest).some((assetName) => assetName.includes('service-worker'))).toBe(
    false,
  )
})
