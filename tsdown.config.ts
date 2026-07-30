import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['./src/big.ts'],
    format: ['esm', 'cjs'],
    outDir: 'dist',
    platform: 'neutral',
    fixedExtension: false,
    dts: true,
    sourcemap: false,
    clean: true,
    exports: false,
    attw: false,
    publint: false,
    outputOptions(options, format) {
      options.exports = 'named';
      if (format === 'cjs') {
        // big.js interop: require('fastdecimal') must return the constructor
        // function directly (module.exports = Big), exactly like require('big.js').
        // Big already carries .default and .Big self-references, so one
        // reassignment preserves both named access patterns.
        options.outro = 'module.exports = exports.default;';
      }
      return options;
    },
  },
  {
    entry: { 'browser.global': './src/big.ts' },
    format: 'umd',
    outDir: 'dist',
    platform: 'browser',
    globalName: 'fastdecimal',
    minify: true,
    sourcemap: false,
    dts: false,
    clean: false,
    exports: false,
    attw: false,
    publint: false,
    outputOptions: {
      entryFileNames: '[name].js',
      exports: 'named',
    },
  },
]);
