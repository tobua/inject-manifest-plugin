import { deepmerge } from 'deepmerge-ts'
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'

const defaultConfiguration: webpack.Configuration = {
  // mode: 'development',
  // devtool: undefined,
  plugins: [new HtmlWebpackPlugin({ excludeChunks: ['service-worker'] })],
}

export default (configuration: webpack.Configuration[]) =>
  new Promise<'error' | 'success'>((done) => {
    webpack(deepmerge(configuration, defaultConfiguration), (error, stats) => {
      if (error || (stats && stats.hasErrors())) {
        // eslint-disable-next-line no-console
        console.log(error, stats && stats.hasErrors() && stats.toJson({}).errors)
        done('error')
      }
      done('success')
    })
  })
