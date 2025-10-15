const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/main.serverless.ts',
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
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  externals: {
    // 排除不需要打包的模块
    'aws-sdk': 'aws-sdk',
  },
};
