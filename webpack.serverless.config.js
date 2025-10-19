const path = require('path');
const webpack = require('webpack');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'src/main.serverless.ts'),
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.serverless.js',
    libraryTarget: 'commonjs2',
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: path.resolve(__dirname, 'tsconfig.json'),
          },
        },
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  },
  externals: {
    // 排除不需要打包的模块
    'aws-sdk': 'aws-sdk',
  },
  plugins: [
    // 忽略所有 .d.ts 文件
    new webpack.IgnorePlugin({
      resourceRegExp: /\.d\.ts$/,
    }),
  ],
  stats: {
    errorDetails: true,
  },
};
