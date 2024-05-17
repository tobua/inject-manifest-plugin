import { test, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  registerVitest,
  environment,
  packageJson,
  prepare,
  file,
  listFilesMatching,
  readFile,
} from 'jest-fixture'
import { rmSync } from 'fs'
import { InjectManifestPlugin } from '../index'
import webpack from './webpack'
import rspack from './rspack'
import { findManifest } from './helper'

registerVitest(beforeEach, afterEach, vi)

const [fixturePath] = environment('configuration')

const run = async (
  name: string,
  runner: (
    build: (configuration: any, defaultConfiguration?: any) => Promise<'error' | 'success'>,
    type: 'webpack' | 'rspack',
  ) => Promise<void>,
) => {
  test(`webpack: ${name}`, async () => {
    await runner(webpack, 'webpack')
  })
  rmSync(fixturePath, { recursive: true, force: true })
  test(`rspack: ${name}`, async () => {
    await runner(rspack, 'rspack')
  })
}

run('Works with various optimization properties in bundler configuration.', async (build) => {
  const { dist } = prepare([
    packageJson('optimization'),
    file('index.js', "console.log('entry')"),
    file('service-worker.js', "console.log('worker', self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await build({
    entry: ['./index.js'],
    optimization: {
      minimize: true,
      moduleIds: 'named',
      providedExports: true,
      sideEffects: true,
      splitChunks: {
        cacheGroups: {
          vendor: {
            chunks: 'all',
            name: 'vendor',
            test: /common/,
          },
        },
      },
    },
    output: {
      clean: true,
      filename: '[name].js',
    },
    plugins: [new InjectManifestPlugin()],
  })

  expect(buildResult).toBe('success')

  const files = listFilesMatching('*', '.')

  expect(files.length).toBe(3)

  const distFiles = listFilesMatching('**/*', dist)

  expect(distFiles.length).toBe(3)
  expect(distFiles).toContain('main.js')
  expect(distFiles).toContain('service-worker.js')
  expect(distFiles).toContain('index.html')

  const manifest = findManifest(readFile('dist/service-worker.js'))

  expect(Object.keys(manifest).length).toBe(2)
  expect(manifest['main.js'].length).toBe(32)
  expect(manifest['index.html'].length).toBe(32)
})
