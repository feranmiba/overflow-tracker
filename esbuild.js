const esbuild = require('esbuild');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  minify: isProduction,
  sourcemap: !isProduction,
  sourcesContent: false,
  platform: 'node',
  outfile: 'dist/extension.js',
  external: ['vscode'],
  logLevel: 'info',
};

async function main() {
  if (isWatch) {
    const ctx = await esbuild.context(config);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(config);
    console.log('Build completed successfully.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
