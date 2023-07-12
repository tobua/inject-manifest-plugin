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

registerVitest(beforeEach, afterEach, vi)

const [fixturePath] = environment('basic')

const run = async (
  name: string,
  runner: (
    build: (configuration: any) => Promise<'error' | 'success'>,
    type: 'webpack' | 'rspack'
  ) => Promise<void>
) => {
  test(`webpack: ${name}`, async () => {
    await runner(webpack, 'webpack')
  })
  rmSync(fixturePath, { recursive: true, force: true })
  test(`rspack: ${name}`, async () => {
    await runner(rspack, 'rspack')
  })
}

const findManifest = (source: string): { [key: string]: string } => {
  const regex = /\[[^\]]*(?:\{'url':'[^']*.js','revision':'[a-f0-9]{32}'\}[^\]]*)*\]/
  const matches = source.match(regex)

  if (matches) {
    const snippet = matches[0]
    // @ts-ignore
    const data = JSON.parse(snippet.replaceAll("'", '"')) as { url: string; revision: string }[]
    const result = {}
    data.forEach((entry) => {
      result[entry.url] = entry.revision
    })
    return result
  }

  return {}
}

run('Regular build is working fine.', async (build) => {
  const { dist } = prepare([packageJson('basic'), file('index.js', "console.log('entry')")])

  const buildResult = await build({ entry: './index.js' })

  expect(buildResult).toBe('success')

  const files = listFilesMatching('*', '.')

  expect(files.length).toBe(2)

  const distFiles = listFilesMatching('**/*', dist)

  expect(distFiles.length).toBe(2)
  expect(distFiles).toContain('main.js')
  expect(distFiles).toContain('index.html')
})

run('Regular build with plugin is working fine.', async (build) => {
  const { dist } = prepare([
    packageJson('basic'),
    file('index.js', "console.log('entry')"),
    file('service-worker.js', "console.log('worker')"),
  ])

  const buildResult = await build({
    entry: ['./index.js'],
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
})

run('Manifest data is injected into service worker.', async (build) => {
  const { dist } = prepare([
    packageJson('basic'),
    file('index.js', "console.log('main-entry')"),
    file('service-worker.js', "console.log('Hello World!', self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await build({
    entry: { main: './index.js' },
    plugins: [new InjectManifestPlugin()],
  })

  expect(buildResult).toBe('success')

  expect(listFilesMatching('**/*', dist).length).toBe(3)

  const htmlContents = readFile('dist/index.html')

  expect(htmlContents).toContain('main.js')
  expect(htmlContents).not.toContain('service-worker.js')

  const mainContents = readFile('dist/main.js')

  expect(mainContents).toContain('main-entry')
  expect(mainContents).not.toContain('Hello World!')

  const workerContents = readFile('dist/service-worker.js')

  expect(workerContents).not.toContain('main-entry')
  expect(workerContents).toContain('Hello World!')

  const manifest = findManifest(workerContents)

  expect(Object.keys(manifest).length).toBe(2)
  expect(manifest['main.js'].length).toBe(32)
  expect(manifest['index.html'].length).toBe(32)
})

run('Files can be excluded from the manifest.', async (build) => {
  const { dist } = prepare([
    packageJson('basic'),
    file('first.js', "console.log('main-entry')"),
    file('second.js', "console.log('second-entry')"),
    file('nested/third.js', "console.log('third-entry')"),
    file('nested/fourth.js', "console.log('fourth-entry')"),
    file('nested/deep/fifth.js', "console.log('fifth-entry')"),
    file('nested/deep/sixth.js', "console.log('sixth-entry')"),
    file('nested/deep/deeper/seventh.js', "console.log('seventh-entry')"),
    file('service-worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
  ])

  const buildResult = await build({
    entry: {
      main: './first.js',
      second: './second.js',
      third: './nested/third.js',
      fourth: './nested/fourth.js',
      fifth: './nested/deep/fifth.js',
      sixth: './nested/deep/sixth.js',
      seventh: './nested/deep/deeper/seventh.js',
    },
    plugins: [
      new InjectManifestPlugin({
        exclude: ['second*', 'third.*', 'four*.*', 'fifth.ts'],
      }),
    ],
  })

  expect(buildResult).toBe('success')

  expect(listFilesMatching('**/*', dist).length).toBe(9)

  const manifest = findManifest(readFile('dist/service-worker.js'))

  expect(Object.keys(manifest).length).toBe(5)
  expect(manifest['main.js']).toBeDefined()
  expect(manifest['second.js']).toBeUndefined()
  expect(manifest['third.js']).toBeUndefined()
  expect(manifest['fourth.js']).toBeUndefined()
  expect(manifest['fifth.js']).toBeDefined()
})

run('The injection variable can be configured.', async (build) => {
  prepare([
    packageJson('basic'),
    file('index.js', ''),
    file('service-worker.js', 'console.log(replace_me)'),
  ])

  const buildResult = await build({
    entry: { main: './index.js' },
    plugins: [new InjectManifestPlugin({ injectionPoint: 'replace_me' })],
  })

  expect(buildResult).toBe('success')

  const manifest = findManifest(readFile('dist/service-worker.js'))

  expect(Object.keys(manifest).length).toBe(2)
  expect(manifest['main.js'].length).toBe(32)
  expect(manifest['index.html'].length).toBe(32)
})

run('Service worker path can be customized.', async (build) => {
  prepare([
    packageJson('basic'),
    file('index.js', ''),
    file('nested/worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
  ])

  const buildResult = await build({
    entry: { main: './index.js' },
    plugins: [new InjectManifestPlugin({ file: './nested/worker.js' })],
  })

  expect(buildResult).toBe('success')

  const manifest = findManifest(readFile('dist/service-worker.js'))

  expect(Object.keys(manifest).length).toBe(2)
  expect(manifest['main.js'].length).toBe(32)
  expect(manifest['index.html'].length).toBe(32)
})

run('Option to remove a hash from the service worker can be set.', async (build) => {
  const { dist } = prepare([
    packageJson('basic'),
    file('index.js', "console.log('entry')"),
    file('service-worker.js', "console.log('worker')"),
  ])

  const buildResult = await build({
    entry: ['./index.js'],
    output: {
      filename: '[name].[contenthash].js',
    },
    plugins: [
      new InjectManifestPlugin({
        removeHash: true,
      }),
    ],
  })

  expect(buildResult).toBe('success')

  const files = listFilesMatching('*', '.')

  expect(files.length).toBe(3)

  const distFiles = listFilesMatching('**/*', dist)

  expect(distFiles.length).toBe(3)
  expect(distFiles.find((filename) => filename.match(/^main\.[0-9a-f]{20}\.js$/))).toBeDefined()
  expect(distFiles).toContain('service-worker.js')
  expect(distFiles).toContain('index.html')
})
