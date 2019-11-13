import svelte from 'rollup-plugin-svelte'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import livereload from 'rollup-plugin-livereload'
// import { terser } from 'rollup-plugin-terser'
import autoPreprocess from 'svelte-preprocess';

const production = !process.env.ROLLUP_WATCH

export default {
  input: 'src/index.js',
  output: [
    {
      sourcemap: true,
      format: 'cjs',
      name: 'devtools-cjs',
      dir: 'dist/cjs'
    },{
      sourcemap: true,
      format: 'esm',
      name: 'devtools-esm',
      dir: 'dist/esm'
    },
  ],
  plugins: [
    svelte({
      // enable run-time checks when not in production
      dev: !production,

      preprocess: autoPreprocess(),
    }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration —
    // consult the documentation for details:
    // https://github.com/rollup/rollup-plugin-commonjs
    resolve({
      // browser: true,
      dedupe: importee => importee === 'svelte' || importee.startsWith('svelte/')
    }),
    commonjs(),

    // Watch the `public` directory and refresh the
    // browser on changes when not in production
    !production && livereload('dist'),

    // If we're building for production (npm run build
    // instead of npm run dev), minify
    // production && terser()
  ],
  watch: {
    clearScreen: false
  }
}
