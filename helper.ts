export async function loadHtmlWebpackPluginIfInstalled() {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    return (await import('html-webpack-plugin'))?.default
  } catch (error) {
    return null
  }
}
