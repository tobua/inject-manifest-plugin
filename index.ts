import { createHash } from 'crypto'
import { type Compiler as WebpackCompiler } from 'webpack'
import { type Compiler as RspackCompiler } from '@rspack/core'
import { validate } from 'schema-utils'
import { minimatch } from 'minimatch'

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
  },
  additionalProperties: false,
} as const

type Options = {
  file: string
  injectionPoint: string
  exclude: string[]
  removeHash: boolean
}

export class InjectManifestPlugin {
  name = 'InjectManifestPlugin'
  options: Options

  static defaultOptions = {
    file: './service-worker.js',
    injectionPoint: 'self.INJECT_MANIFEST_PLUGIN',
    exclude: [],
    removeHash: false,
  }

  constructor(options = {}) {
    validate(schema, options, {
      name: this.name,
      baseDataPath: 'options',
    })

    this.options = { ...InjectManifestPlugin.defaultOptions, ...options }
  }

  apply(compiler: WebpackCompiler | RspackCompiler) {
    // @ts-ignore
    compiler.hooks.entryOption.tap(this.name, (_, entry) => {
      entry['service-worker'] = { import: [this.options.file] }
    })

    if (this.options.removeHash) {
      compiler.hooks.emit.tap(this.name, (compilation) => {
        const { assets } = compilation
        const filenames = Object.keys(assets)
        const worker = filenames.find((name) => name.includes('service-worker'))
        if (worker.length > 32) {
          const source = assets[worker]
          assets['service-worker.js'] = source
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
        (assets) => {
          const filenames = Object.keys(assets)
          const manifest = JSON.stringify(
            filenames
              .filter(
                (filename) =>
                  filename !== 'service-worker.js' &&
                  !this.options.exclude.some((matcher) =>
                    minimatch(filename, matcher, { partial: true })
                  )
              )
              .map((filename) => ({
                url: filename,
                revision: createHash('md5').update(assets[filename].source()).digest('hex'),
              }))
          ).replaceAll('"', "'") // Already escaped with double quotes in dev mode.

          const regex = new RegExp(this.options.injectionPoint)

          Object.keys(assets).forEach((filename) => {
            if (filename.endsWith('.js')) {
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
