import type { RsbuildPlugin } from '@rsbuild/core';

// https://rsbuild.dev/plugins/dev/hooks

export default (): RsbuildPlugin => ({
  name: 'inject-manifest-plugin',
  setup: (api: RsbuildPluginAPI) => {
    console.log(api.context)
    api.onAfterBuild(() => {
      console.log('after build!');
    });
  },
});