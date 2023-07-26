<p align="center">
  <img src="https://github.com/tobua/inject-manifest-plugin/raw/main/logo.png" alt="inject-manifest-plugin" width="30%">
</p>

# inject-manifest-plugin

Injects a Workbox PWA manifest into a Service Worker. Alternative for the InjectManifest plugin in the [workbox-webpack-plugin](https://www.npmjs.com/package/workbox-webpack-plugin).

- Supports **webpack** and **Rspack**
- Compatible with Google Workbox
- Check out the [demo](https://papua-pwa.vercel.app) or the [papua PWA template](https://github.com/tobua/papua/tree/main/template/pwa)
  - Get started by running `npm init now papua ./my-pwa pwa`
- Replaces `self.INJECT_MANIFEST_PLUGIN` variable in a `service-worker.[jt]s` file with a `{ url: string; revision: string (hash) }` array.

## service-worker File

To get started add a `service-worker.js` or `service-worker.ts` file to the root of the project and install the necessary dependencies with `npm install url-join workbox-core workbox-expiration workbox-precaching workbox-routing workbox-strategies`.

```ts
import join from 'url-join'
import { clientsClaim } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

clientsClaim() // Allows updating open service workers.

// Add types for the plugin and workbox.
declare global {
  interface Window {
    INJECT_MANIFEST_PLUGIN: { url: string; revision: string }[]
    skipWaiting: Function
  }
}

// Add all assets generated during build to the browser cache.
precacheAndRoute(self.INJECT_MANIFEST_PLUGIN)

const fileExtensionRegexp = new RegExp('/[^/?]+\\.[^/]+$')
registerRoute(
  // Return false to exempt requests from being fulfilled by index.html.
  ({ request, url }) => {
    // If this isn't a navigation, skip.
    if (request.mode !== 'navigate') {
      return false
    } // If this is a URL that starts with /_, skip.

    if (url.pathname.startsWith('/_')) {
      return false
    } // If this looks like a URL for a resource, because it contains // a file extension, skip.

    if (url.pathname.match(fileExtensionRegexp)) {
      return false
    } // Return true to signal that we want to use the handler.

    return true
  },
  createHandlerBoundToURL(join(process.env.PUBLIC_URL as string, '/index.html'))
)

// An example runtime caching route for requests that aren't handled by the
// precache, in this case same-origin .png requests like those from in public/
registerRoute(
  // Add in any other file extensions or routing criteria as needed.
  ({ url }) => url.origin === self.location.origin && url.pathname.endsWith('.png'), // Customize this strategy as needed, e.g., by changing to CacheFirst.
  new StaleWhileRevalidate({
    cacheName: 'images',
    plugins: [
      // Ensure that once this runtime cache reaches a maximum size the
      // least-recently used images are removed.
      new ExpirationPlugin({ maxEntries: 50 }),
    ],
  })
)

// Update cached assets after reload without the need for the user to close all open tabs.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
```

## Service Worker Registration

The `service-worker.js` asset created during the build needs to be dynamically loaded and registered from any regular JavaScript entry.

```js
import join from 'url-join'

const store = {
  ready: false,
  update: false,
  error: false,
  offline: false
}

const isLocalhost = Boolean(
  window.location.hostname === 'localhost' ||
    // [::1] is the IPv6 localhost address.
    window.location.hostname === '[::1]' ||
    // 127.0.0.0/8 are considered localhost for IPv4.
    window.location.hostname.match(/^127(?:\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)){3}$/)
)

function registerValidSW(swUrl: string) {
  navigator.serviceWorker
    .register(swUrl)
    .then((registration) => {
      store.ready = true
      registration.onupdatefound = () => {
        const installingWorker = registration.installing
        if (installingWorker == null) {
          return
        }
        installingWorker.onstatechange = () => {
          if (installingWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Force contents to update on reload.
              if (registration && registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' })
              }
              // Timeout to ensure message passed.
              setTimeout(() => { store.update = true }, 100)
            }
          }
        }
      }
    })
    .catch(() => { error = true })
}

function checkValidServiceWorker(swUrl: string) {
  fetch(swUrl, {
    headers: { 'Service-Worker': 'script' },
  })
    .then((response) => {
      const contentType = response.headers.get('content-type')
      if (
        response.status === 404 ||
        (contentType != null && contentType.indexOf('javascript') === -1)
      ) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.unregister().then(() => {
            window.location.reload()
          })
        })
      } else {
        registerValidSW(swUrl)
      }
    })
    .catch(() => { store.offline = true })
}

export function register() {
  if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
    const publicUrl = new URL(process.env.PUBLIC_URL, window.location.href)
    if (publicUrl.origin !== window.location.origin) {
      store.error = true
      return
    }

    window.addEventListener('load', () => {
      const swUrl = join(process.env.PUBLIC_URL, '/service-worker.js')

      if (isLocalhost) {
        checkValidServiceWorker(swUrl)
        navigator.serviceWorker.ready.then(() => Todo.setReady())
      } else {
        registerValidSW(swUrl)
      }
    })
  }
}

// Useful if you had a worker registered in the past on this url.
export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister()
      })
      .catch((error) => { store.error = error.message })
  }
}
```

Call the `register()` method from anywhere:

```jsx
import { register } from './registration'

createRoot(document.body).render(<p>my App!</p>)

register()
```

## Plugin Usage in `webpack.config.mjs` / `rspack.config.mjs`

When used in a project with `webpack-cli` or `@rspack/cli` make sure that the `package.json` contains `"type": "module"` or the configuration file ends with `.mjs`. Both the plugin as well as the registration require the `process.env.PUBLIC_URL` variable to be set.

```js
import { InjectManifestPlugin } from 'inject-manifest-plugin'

export default {
  plugins: [new InjectManifestPlugin()],
}
```

## Configuration

```js
new InjectManifestPlugin({
  file: 'my-worker.js', // Default: service-worker.js
  injectionPoint: 'global.replace-this', // Default: self.INJECT_MANIFEST_PLUGIN
  exclude: ['extension/*'], // Default: []
  removeHash: true, // Default: false
  chunkFilename: 'worker': // Default: service-worker
})
```

`file` should point to a Service Worker file in the project and will automatically be added as an entry. The Service Worker entry chunk will be called `service-worker`. The `injectionPoint` can be any text that will be replaced in the Service Worker code with the generated manifest. Using the `exclude` array it's possible to keep some assets from appearing in the manifest to avoid caching in the Service Worker. The array can include globs and items are matched against the generated assets using [minimatch](https://www.npmjs.com/package/minimatch). With the `removeHash` option it's possible to ensure the name of the generated Service Worker asset matches the input file. A Service Worker cannot change it's name once registered, therefore it's important that no hash is added. Since, this option uses a workaround, it's generally recommended to avoid hashing any JavaScript assets as the Service Worker will usually ensure well enough that all assets are up-to-date. The `chunkFilename` names the injected Service Worker chunk.

## Programmatic Usage

```ts
import webpack from 'webpack'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import { InjectManifestPlugin } from 'inject-manifest-plugin'

const configuration: webpack.Configuration = {
  plugins: [
    new InjectManifestPlugin(),
    new HtmlWebpackPlugin()
  ],
}

// When using programmatic API, otherwise place configuration in webpack.config.js.
webpack(configuration, (error, stats) => { ... })
```

```ts
import { Configuration, rspack } from '@rspack/core'
import { InjectManifestPlugin } from 'inject-manifest-plugin'

const configuration: Configuration = {
  builtins: {
    html: [{}], // Empty object creates a default html template (index.html).
  },
  plugins: [new InjectManifestPlugin()],
}

// When using programmatic API, otherwise place configuration in rspack.config.js.
rspack(configuration, (error, stats) => { ... })
```
