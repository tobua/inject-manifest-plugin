import { deepmerge } from 'deepmerge-ts'
import { Configuration, rspack } from '@rspack/core'

const defaultConfiguration: Configuration = {
  builtins: {
    html: [{}], // Empty object creates a template.
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
