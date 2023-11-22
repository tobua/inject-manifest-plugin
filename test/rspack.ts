import { deepmerge } from 'deepmerge-ts'
import { Configuration, HtmlRspackPlugin, rspack } from '@rspack/core'

const defaultConfiguration: Configuration = {
  plugins: [new HtmlRspackPlugin()],
  module: {
    rules: [
      {
        test: /.jsx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'ecmascript',
              jsx: true,
            },
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /.tsx?$/,
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              jsx: true,
            },
          },
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
        type: 'javascript/auto',
      },
    ],
  },
}

export default (configuration: Configuration, extendedConfiguration = defaultConfiguration) =>
  new Promise<'error' | 'success'>((done) => {
    let mergedConfiguration

    if (Array.isArray(configuration)) {
      configuration.forEach((innerConfiguration, index) => {
        configuration[index] = deepmerge(innerConfiguration, extendedConfiguration)
      })
      mergedConfiguration = configuration
    } else {
      mergedConfiguration = deepmerge(configuration, extendedConfiguration)
    }

    rspack(mergedConfiguration, (error, stats) => {
      if (error || (stats && stats.hasErrors())) {
        // eslint-disable-next-line no-console
        console.log(error, stats && stats.hasErrors() && stats.toJson({}).errors)
        done('error')
      }
      done('success')
    })
  })
