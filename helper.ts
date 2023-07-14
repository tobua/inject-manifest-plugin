export async function loadHtmlWebpackPluginIfInstalled() {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    return (await import('html-webpack-plugin'))?.default
  } catch (error) {
    return null
  }
}

export const removeHash = (filename: string) =>
  filename.replace(/(.+)\.[0-9a-f]{20}(\.js)$/, '$1$2')
