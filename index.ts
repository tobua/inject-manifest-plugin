import { existsSync } from 'fs'
import { isAbsolute, join } from 'path'
import { createHash } from 'crypto'
import type { WebpackOptionsNormalized, Compiler as WebpackCompiler } from 'webpack'
import rspack from '@rspack/core'
import type {
  Compiler as RspackCompiler,
  RspackOptionsNormalized,
  HtmlRspackPluginOptions,
} from '@rspack/core'
import { validate } from 'schema-utils'
import { minimatch } from 'minimatch'
import { isFileHashed, loadHtmlWebpackPluginIfInstalled, removeHash } from './helper'

const schema = {
  type: 'object',
  properties: {
    file: {
      description: 'The filename pointing to the service worker.',
      type: 'string',
    },
    injectionPoint: {
      description:
        'The variable in the service worker to replace with the manifest during the build.',
      type: 'string',
    },
    exclude: {
      description: 'List of globs for files that should be excluded from the manifest.',
      type: 'array',
    },
    removeHash: {
      description: 'Removes hash in the emitted filename of the service worker.',
      type: 'boolean',
    },
    chunkName: {
      description: 'The name of the service worker chunk.',
      type: 'string',
    },
  },
  additionalProperties: false,
} as const

type PluginOptions = {
  file: string
  injectionPoint: string
  exclude: string[]
  removeHash: boolean
  chunkName: string
}

export type Options = Partial<PluginOptions>

export class InjectManifestPlugin {
  name = 'InjectManifestPlugin'
  options: PluginOptions
  outputFilename: string
  isRspack: boolean

  static defaultOptions: PluginOptions = {
    file: './service-worker.js',
    injectionPoint: 'self.INJECT_MANIFEST_PLUGIN',
    exclude: [],
    removeHash: false,
    chunkName: 'service-worker',
  }

  constructor(options: Options = {}) {
    validate(schema, options, {
      name: this.name,
      baseDataPath: 'options',
    })

    this.options = { ...InjectManifestPlugin.defaultOptions, ...options }
    this.outputFilename = `${this.options.chunkName}.js`
  }

  apply(compiler: WebpackCompiler | RspackCompiler) {
    // @ts-ignore Will fail in Rspack with return value.
    compiler.hooks.entryOption.tap(this.name, (contextPath, entry) => {
      if (entry[this.options.chunkName]) return
      const workerFileInContext = isAbsolute(this.options.file)
        ? this.options.file
        : join(contextPath, this.options.file)
      if (existsSync(workerFileInContext)) {
        entry[this.options.chunkName] = { import: [this.options.file] }
      }
    })

    // Exclude worker chunk from being emitted into templates.
    compiler.hooks.environment.tap(this.name, async () => {
      this.isRspack = (compiler as RspackCompiler)?.webpack?.rspackVersion
      const { options } = compiler
      const HtmlWebpackPlugin = await loadHtmlWebpackPluginIfInstalled()

      if (this.isRspack) {
        const { plugins } = options as RspackOptionsNormalized

        if (plugins && plugins.length > 0 && rspack.HtmlRspackPlugin) {
          ;(plugins as unknown as { _options: HtmlRspackPluginOptions }[]).forEach((plugin) => {
            // eslint-disable-next-line no-underscore-dangle
            const htmlOptions = plugin._options ?? (plugin as any).options
            if (
              plugin instanceof rspack.HtmlRspackPlugin ||
              // NOTE imperfect HtmlWebpackPlugin detection compatible with Rsbuild.
              (htmlOptions && htmlOptions.template)
            ) {
              if (Array.isArray(htmlOptions.excludedChunks)) {
                if (!htmlOptions.excludedChunks.includes(this.options.chunkName)) {
                  htmlOptions.excludedChunks.push(this.options.chunkName)
                }
              } else {
                htmlOptions.excludedChunks = [this.options.chunkName]
              }
            }
          })
        }
      } else {
        const { plugins } = options as WebpackOptionsNormalized

        if (plugins && plugins.length > 0 && HtmlWebpackPlugin) {
          plugins.forEach((plugin) => {
            if (plugin && plugin instanceof HtmlWebpackPlugin && plugin.options) {
              const htmlOptions = plugin.options
              if (Array.isArray(htmlOptions.excludedChunks)) {
                if (!htmlOptions.excludeChunks.includes(this.options.chunkName)) {
                  htmlOptions.excludeChunks.push(this.options.chunkName)
                }
              } else {
                htmlOptions.excludeChunks = [this.options.chunkName]
              }
            }
          })
        }
      }
    })

    // Build manifest from built assets.
    compiler.hooks.thisCompilation.tap(this.name, (compilation: any) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: 1000,
          additionalAssets: undefined, // Run again when more assets are added later.
        },
        (assets: Record<string, any>) => {
          const filenames = Object.keys(assets)
          // NOTE compilation.chunks is a Set in webpack and array methods lead to a deprecation warning.
          const workerFileNames = [...compilation.chunks].find(
            (chunk) => chunk.name === this.options.chunkName,
          )?.files
          const manifest = JSON.stringify(
            filenames
              .filter(
                (filename) =>
                  // Remove service-worker chunk.
                  // NOTE same Set to array conversion as for compilation.chunks.
                  ![...workerFileNames].includes(filename) &&
                  // Remove excludes.
                  !this.options.exclude.some((matcher) =>
                    minimatch(filename, matcher, { partial: true }),
                  ),
              )
              .map((filename) => ({
                url: filename,
                revision: isFileHashed(filename)
                  ? null
                  : createHash('md5').update(assets[filename].source()).digest('hex'),
              })),
          ).replaceAll('"', "'") // Already escaped with double quotes in dev mode.

          const regex = new RegExp(this.options.injectionPoint)

          Object.keys(assets).forEach((filename) => {
            const filenameMatch = removeHash(filename)
            const isWorkerFilename = filenameMatch.endsWith(this.outputFilename)

            if (isWorkerFilename) {
              const source = assets[filename].source().toString() as string
              if (regex.test(source)) {
                compilation.updateAsset(
                  filename,
                  new compiler.webpack.sources.RawSource(source.replace(regex, manifest)),
                )
              }
            }
          })
        },
      )
    })

    // Rename service-worker asset, happens after processAssets.
    compiler.hooks.emit.tap(this.name, (compilation: any) => {
      const { assets } = compilation
      const filenames = Array.isArray(assets) ? assets : Object.keys(assets)
      const worker = filenames.find((name) => name.includes(this.options.chunkName))
      if (worker) {
        const asset = compilation.getAsset(worker)
        if (asset) {
          compilation.renameAsset(asset.name, this.outputFilename)
        }
      } else {
        // eslint-disable-next-line no-console
        console.error('inject-manifest-plugin: service worker chunk not found.')
      }
    })
  }
}
