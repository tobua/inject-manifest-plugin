import { createRsbuild, RsbuildConfig } from '@rsbuild/core'

export default async (configuration: RsbuildConfig) => {
  const rsbuild = await createRsbuild({ cwd: process.cwd(), rsbuildConfig: configuration })
  await rsbuild.build()
  return 'success'
}
