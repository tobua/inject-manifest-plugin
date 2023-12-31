import { deepmerge } from 'deepmerge-ts'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'

const defaultConfiguration: webpack.Configuration = {
  plugins: [new HtmlWebpackPlugin()],
}

export default (
  configuration: webpack.Configuration[] | webpack.Configuration,
  extendedConfiguration = defaultConfiguration,
) =>
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

    webpack(mergedConfiguration, (error, stats) => {
      if (error || (stats && stats.hasErrors())) {
        // eslint-disable-next-line no-console
        console.log(error, stats && stats.hasErrors() && stats.toJson({}).errors)
        done('error')
      }
      done('success')
    })
  })
