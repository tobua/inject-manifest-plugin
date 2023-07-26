export const findManifest = (source: string): { [key: string]: string } => {
  const regex = /\[[^\]]*(?:\{'url':'[^']*.*','revision':'[a-f0-9]{32}'\}[^\]]*)+\]/
  const matches = source.match(regex)

  if (matches) {
    const snippet = matches[0]
    // @ts-ignore
    const data = JSON.parse(snippet.replaceAll("'", '"')) as { url: string; revision: string }[]
    const result = {}
    data.forEach((entry) => {
      result[entry.url] = entry.revision
    })
    return result
  }

  return {}
}
