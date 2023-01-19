const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

module.exports = webpackEnv => {
    const isEnvProduction = webpackEnv === 'production';

    return {
        devServer: {
            hot: true,
            static: './examples'
        },
        devtool: 'source-map',
        entry: ['./examples/index.jsx'],
        mode: isEnvProduction ? 'production' : 'development',
        module: {
            rules: [
                {
                    test: /\.jsx?$/,
                    exclude: /node_modules/,
                    use: {
                        loader: 'babel-loader',
                        options: {
                            plugins: isEnvProduction
                                ? []
                                : [require.resolve('react-refresh/babel')]
                        }
                    }
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                }
            ]
        },
        output: {
            filename: 'bundle.js'
        },
        plugins: isEnvProduction ? [] : [new ReactRefreshWebpackPlugin()],
        resolve: {
            extensions: ['.js', '.jsx']
        }
    };
};
