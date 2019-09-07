require('babel-polyfill')
const webpack = require('webpack')
const html = require('html-webpack-plugin')
const path = require('path')
const MinifyPlugin = require("babel-minify-webpack-plugin")
const brotliPlugin = require('brotli-gzip-webpack-plugin')

module.exports = {
    mode: process.env.NODE_ENV,
    devtool: process.env.NODE_ENV === 'production' ? '' : 'eval-source-map',
    entry: ['babel-polyfill', './src/index.js'],
    output: {
        filename: 'build.js',
        path: path.join(__dirname, 'dist')
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader'
                }
            }, {
                test: /\.styl$/,
                exclude: /node_modules/,
                use: [
                    {loader: 'style-loader'},
                    {loader: 'css-loader'},
                    {loader: 'stylus-loader'}
                ]
            }
        ]
    },
    plugins: [
        new html({
            title: "Programable Automated Ethereum Token Payments",
            template: './src/index.ejs',
            hash: true
        }),
        new MinifyPlugin(),
        new brotliPlugin({
            asset: '[file].br[query]',
            algorithm: 'brotli',
            test: /\.(js|css|html|svg)$/,
            threshold: 10240,
            minRatio: 0.8,
            quality: 11,
        }),
        new brotliPlugin({
            asset: '[file].gz[query]',
            algorithm: 'gzip',
            test: /\.(js|css|html|svg)$/,
            threshold: 10240,
            minRatio: 0.8,
        }),
    ]
}
