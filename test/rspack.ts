import { deepmerge } from 'deepmerge-ts'
import { Configuration, rspack } from '@rspack/core'

const defaultConfiguration: Configuration = {
  builtins: {
    html: [{}], // Empty object creates a template.
  },
}

export default (configuration: Configuration) =>
  new Promise<'error' | 'success'>((done) => {
    rspack(deepmerge(configuration, defaultConfiguration), (error, stats) => {
      if (error || (stats && stats.hasErrors())) {
        // eslint-disable-next-line no-console
        console.log(error, stats && stats.hasErrors() && stats.toJson({}, true).errors)
        done('error')
      }
      done('success')
    })
  })
