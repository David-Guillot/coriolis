module.exports = {
  root: true,
  parser: 'babel-eslint',
  env: {
    browser: true,
    commonjs: true,
    es6: true,
    node: true,
  },
  extends: ['standard', 'plugin:prettier/recommended'],
  globals: {},
  parserOptions: {
    ecmaVersion: 2018,
  },
  rules: {
    'no-sequences': 'off',
  },
  overrides: [
    {
      files: ['src/test/**/*.js'],
      env: {
        mocha: true,
      },
      globals: {
        expect: true,
        sinon: true,
        withParams: true,
        useParams: true,
      },
    },
  ],
}
