<p align="center">
  <img src="https://github.com/tobua/inject-manifest-plugin/raw/main/logo.png" alt="inject-manifest-plugin" width="30%">
</p>

# inject-manifest-plugin

Injects a Workbox PWA manifest into a Service Worker. Alternative for the InjectManifest plugin in the [workbox-webpack-plugin](https://www.npmjs.com/package/workbox-webpack-plugin).

- Supports **webpack** and **Rspack**
- Compatible with Google Workbox

## Usage

When using `webpack` it's important to exclude the `service-worker` chunk from the HTML output.

```ts
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { InjectManifestPlugin } from 'inject-manifest-plugin'

const configuration: webpack.Configuration = {
  plugins: [
    new InjectManifestPlugin(),
    new HtmlWebpackPlugin({ excludeChunks: ['service-worker'] })
  ],
}

// When using programmatic API, otherwise place configuration in webpack.config.js.
webpack(configuration, (error, stats) => { ... })
```

With `Rspack` the `excludedChunks` option in `builtins.html` will ensure that the Service Worker is installed through JavaScript.

```ts
import { Configuration, rspack } from '@rspack/core'
import { InjectManifestPlugin } from 'inject-manifest-plugin'

const configuration: Configuration = {
  builtins: {
    html: [{ excludedChunks: ['service-worker'] }],
  },
  plugins: [ new InjectManifestPlugin() ],
}

// When using programmatic API, otherwise place configuration in rspack.config.js.
rspack(configuration, (error, stats) => { ... })
```

## Configuration

```js
new InjectManifestPlugin({
  file: 'my-worker.js', // Default: service-worker.js
  injectionPoint: 'global.replace-this', // Default: self.INJECT_MANIFEST_PLUGIN
  exclude: ['extension/*'], // Default: []
  removeHash: true, // Default: false
})
```

`file` should point to a Service Worker file in the project and will automatically be added as an entry. The Service Worker entry chunk will be called `service-worker`. The `injectionPoint` can be any text that will be replaced in the Service Worker code with the generated manifest. Using the `exclude` array it's possible to keep some assets from appearing in the manifest to avoid caching in the Service Worker. The array can include globs and items are matched against the generated assets using [minimatch](https://www.npmjs.com/package/minimatch). With the `removeHash` option it's possible to ensure the name of the generated Service Worker asset matches the input file. A Service Worker cannot change it's name once registered, therefore it's important that no hash is added. Since, this option uses a workaround, it's generally recommended to avoid hashing any JavaScript assets as the Service Worker will usually ensure well enough that all assets are up-to-date.
