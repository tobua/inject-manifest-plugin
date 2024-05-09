export async function loadHtmlWebpackPluginIfInstalled() {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    return (await import('html-webpack-plugin'))?.default
  } catch (error) {
    return null
  }
}

// Rspack and webpack have hashlenght 20 and 8 is for Rsbuild.
export const removeHash = (filename: string) =>
  filename.replace(/(.+)\.[0-9a-f]{8,20}(\.js)$/, '$1$2')

export const isFileHashed = (filename: string) => removeHash(filename) !== filename
