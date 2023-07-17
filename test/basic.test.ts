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
import { copyFileSync, rmSync } from 'fs'
import { join } from 'path'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { InjectManifestPlugin } from '../index'
import webpack from './webpack'
import rspack from './rspack'
import { findManifest } from './helper'

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

run('Works with relative "file" paths.', async (build) => {
  prepare([
    packageJson('basic'),
    file('index.js', ''),
    file('worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
  ])

  await build({
    entry: { main: './index.js' },
    plugins: [new InjectManifestPlugin({ file: './worker.js' })],
  })

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
})

run('Works with absolute "file" paths.', async (build) => {
  prepare([
    packageJson('basic'),
    file('index.js', ''),
    file('worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
  ])

  await build({
    entry: { main: './index.js' },
    plugins: [new InjectManifestPlugin({ file: join(process.cwd(), 'worker.js') })],
  })

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
})

run('Option to remove a hash from the service worker can be set.', async (build) => {
  const { dist } = prepare([
    packageJson('basic'),
    file('index.js', "console.log('entry')"),
    file('service-worker.js', "console.log('worker', self.INJECT_MANIFEST_PLUGIN)"),
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

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
})

run('Various hash types are supported.', async (build) => {
  const { dist } = prepare([
    packageJson('basic'),
    file('index.js', "console.log('entry')"),
    file('service-worker.js', "console.log('worker', self.INJECT_MANIFEST_PLUGIN)"),
  ])

  const buildResult = await build({
    entry: ['./index.js'],
    output: {
      // Tested: [chunkhash] [contenthash] [hash] [fullhash] [modulehash] (empty)
      filename: '[name].[fullhash].js',
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

  const manifest = findManifest(readFile('dist/service-worker.js'))
  expect(Object.keys(manifest).length).toBe(2)
})

run('Compiles Service Worker setup with workbox dependencies.', async (build) => {
  prepare([packageJson('basic'), file('index.js', 'console.log("empty")')])

  copyFileSync(
    join(process.cwd(), '../../data/service-worker.js'),
    join(process.cwd(), 'service-worker.js')
  )

  await build({
    entry: { main: './index.js' },
    plugins: [new InjectManifestPlugin()],
    // Avoid mangling for readable output.
    mode: 'development',
    devtool: false,
  })

  const workerContents = readFile('dist/service-worker.js')

  // From workbox dependencies.
  expect(workerContents).toContain('createHandlerBoundToURL')
  expect(workerContents).toContain('removeIgnoredSearchParams')

  const manifest = findManifest(workerContents)
  expect(Object.keys(manifest).length).toBe(2)
})

run(
  'When using multiple templates the worker chunk is excluded from every template.',
  async (build, type) => {
    const { dist } = prepare([
      packageJson('basic'),
      file('index.js', "console.log('main-entry')"),
      file('service-worker.js', "console.log('Hello World!', self.INJECT_MANIFEST_PLUGIN)"),
    ])

    const plugins: any[] = [new InjectManifestPlugin()]

    if (type === 'webpack') {
      plugins.push(new HtmlWebpackPlugin({ title: 'Webpack', filename: 'second.html' }))
    }

    await build({
      entry: { main: './index.js' },
      plugins,
      ...(type === 'rspack' && {
        builtins: { html: [{ title: 'Rspack', filename: 'second.html' }] },
      }),
    })

    expect(listFilesMatching('**/*', dist).length).toBe(4)

    expect(readFile('dist/index.html')).not.toContain('service-worker.js')
    expect(readFile('dist/second.html')).not.toContain('service-worker.js')
  }
)

run('Manifest can only be injected into Service Worker file.', async (build) => {
  prepare([
    packageJson('basic'),
    file('src/index.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
    file('service-worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
  ])

  const buildResult = await build({
    plugins: [new InjectManifestPlugin()],
  })

  expect(buildResult).toBe('success')

  const manifest = findManifest(readFile('dist/service-worker.js'))

  expect(Object.keys(manifest).length).toBe(2)

  const manifestJavaScript = findManifest(readFile('dist/main.js'))

  expect(Object.keys(manifestJavaScript).length).toBe(0)
})

run(
  'Service Worker only injected into configurations where the plugin is added.',
  async (build) => {
    prepare([
      packageJson('basic'),
      file('index.js', ''),
      file('service-worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
      file('extension/index.js', ''),
      file('extension/service-worker.js', 'console.log(self.INJECT_MANIFEST_PLUGIN)'),
    ])

    await build([
      {
        entry: { main: './index.js' },
        plugins: [new InjectManifestPlugin()],
      },
      {
        context: join(process.cwd(), 'extension'),
        entry: { ui: './index.js' },
        output: {
          path: join(process.cwd(), 'extension/dist'),
        },
        // plugins: [new InjectManifestPlugin()],
      },
    ])

    const allFiles = listFilesMatching('**/*', '.')

    expect(allFiles).toContain('extension/dist/ui.js')
    expect(allFiles).not.toContain('extension/dist/service-worker.js')

    const manifest = findManifest(readFile('dist/service-worker.js'))
    expect(Object.keys(manifest).length).toBe(2)
  }
)

run('Plugin can be added to multiple configurations.', async (build) => {
  prepare([
    packageJson('basic'),
    file('index.js', ''),
    file('service-worker.js', 'console.log("location_index", self.INJECT_MANIFEST_PLUGIN)'),
    file('extension/index.js', ''),
    file(
      'extension/service-worker.js',
      'console.log("location_extension", self.INJECT_MANIFEST_PLUGIN)'
    ),
  ])

  await build([
    {
      entry: { main: './index.js' },
      plugins: [new InjectManifestPlugin()],
    },
    {
      context: join(process.cwd(), 'extension'),
      entry: { ui: './index.js' },
      output: {
        path: join(process.cwd(), 'extension/dist'),
      },
      plugins: [new InjectManifestPlugin()],
    },
  ])

  const allFiles = listFilesMatching('**/*', '.')

  expect(allFiles).toContain('extension/dist/ui.js')
  expect(allFiles).toContain('extension/dist/service-worker.js')

  const indexWorkerContents = readFile('dist/service-worker.js')
  expect(indexWorkerContents).toContain('location_index')
  expect(indexWorkerContents).not.toContain('location_extension')
  const manifest = findManifest(indexWorkerContents)
  expect(Object.keys(manifest).length).toBe(2)

  const extensionWorkerContents = readFile('extension/dist/service-worker.js')
  expect(extensionWorkerContents).toContain('location_extension')
  expect(extensionWorkerContents).not.toContain('location_index')
  const manifestExtension = findManifest(extensionWorkerContents)
  expect(Object.keys(manifestExtension).length).toBe(2)
})
