import { createHash } from 'crypto'
import type { WebpackOptionsNormalized, Compiler as WebpackCompiler } from 'webpack'
import type { RspackOptionsNormalized, Compiler as RspackCompiler } from '@rspack/core'
import { validate } from 'schema-utils'
import { minimatch } from 'minimatch'
import { loadHtmlWebpackPluginIfInstalled, removeHash } from './helper'

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

type Options = {
  file: string
  injectionPoint: string
  exclude: string[]
  removeHash: boolean
  chunkName: string
}

export class InjectManifestPlugin {
  name = 'InjectManifestPlugin'
  options: Options
  outputFilename: string

  static defaultOptions = {
    file: './service-worker.js',
    injectionPoint: 'self.INJECT_MANIFEST_PLUGIN',
    exclude: [],
    removeHash: false,
    chunkName: 'service-worker',
  }

  constructor(options = {}) {
    validate(schema, options, {
      name: this.name,
      baseDataPath: 'options',
    })

    this.options = { ...InjectManifestPlugin.defaultOptions, ...options }
    this.outputFilename = `${this.options.chunkName}.js`
  }

  apply(compiler: WebpackCompiler | RspackCompiler) {
    // @ts-ignore
    compiler.hooks.entryOption.tap(this.name, (_, entry) => {
      entry[this.options.chunkName] = { import: [this.options.file] }
    })

    // Exclude worker chunk from being emitted into templates.
    compiler.hooks.environment.tap(this.name, async () => {
      const isRspack = compiler.webpack.rspackVersion
      const { options } = compiler

      if (isRspack) {
        const htmlTemplates = (options as RspackOptionsNormalized).builtins?.html

        // builtins.html is always an array.
        if (htmlTemplates && htmlTemplates.length > 0) {
          htmlTemplates.forEach((template) => {
            if (Array.isArray(template.excludedChunks)) {
              if (!template.excludedChunks.includes(this.options.chunkName)) {
                template.excludedChunks.push(this.options.chunkName)
              }
            } else {
              template.excludedChunks = [this.options.chunkName]
            }
          })
        }
      } else {
        const { plugins } = options as WebpackOptionsNormalized
        const HtmlWebpackPlugin = await loadHtmlWebpackPluginIfInstalled()

        if (plugins && plugins.length > 0 && HtmlWebpackPlugin) {
          plugins.forEach((plugin) => {
            if (plugin instanceof HtmlWebpackPlugin) {
              if (Array.isArray(plugin.options.excludeChunks)) {
                if (!plugin.options.excludeChunks.includes(this.options.chunkName)) {
                  plugin.options.excludeChunks.push(this.options.chunkName)
                }
              } else {
                plugin.options.excludeChunks = [this.options.chunkName]
              }
            }
          })
        }
      }
    })

    if (this.options.removeHash) {
      compiler.hooks.emit.tap(this.name, (compilation) => {
        const { assets } = compilation
        const filenames = Object.keys(assets)
        const worker = filenames.find((name) => name.includes(this.options.chunkName))
        if (worker.length > 32) {
          const source = assets[worker]
          assets[this.outputFilename] = source
          delete assets[worker]
        }
      })
    }

    compiler.hooks.thisCompilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.name,
          stage: 1000,
          additionalAssets: undefined, // Run again when more assets are added later.
        },
        (assets: Record<string, any>) => {
          const filenames = Object.keys(assets)
          const manifest = JSON.stringify(
            filenames
              .filter(
                (filename) =>
                  filename !== this.outputFilename &&
                  !this.options.exclude.some((matcher) =>
                    minimatch(filename, matcher, { partial: true })
                  ) &&
                  (!this.options.removeHash || !removeHash(filename).endsWith(this.outputFilename))
              )
              .map((filename) => ({
                url: filename,
                revision: createHash('md5').update(assets[filename].source()).digest('hex'),
              }))
          ).replaceAll('"', "'") // Already escaped with double quotes in dev mode.

          const regex = new RegExp(this.options.injectionPoint)

          Object.keys(assets).forEach((filename) => {
            const filenameMatch = this.options.removeHash ? removeHash(filename) : filename
            const isWorkerFilename = filenameMatch.endsWith(this.outputFilename)

            if (isWorkerFilename) {
              const source = assets[filename].source().toString() as string
              if (regex.test(source)) {
                compilation.updateAsset(
                  filename,
                  new compiler.webpack.sources.RawSource(source.replace(regex, manifest))
                )
              }
            }
          })
        }
      )
    })
  }
}
