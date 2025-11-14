import path from 'path';


const config = {
    mode: 'production',
    entry: './standalone/standalone.js',
    experiments: {
        outputModule: true,
    },
    output: {
        filename: "standalone.js",
        path: path.resolve(import.meta.dirname, 'dist'),
        clean: true,
        library: {
            type: "modern-module"
        }

    },
    optimization: {
        minimize: false,
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"],
    },
    module: {
        rules: [
            {
                oneOf: [
                    {
                        resourceQuery: /raw/,
                        type: 'asset/source',
                    },
                    {

                        test: /\.m?js$/,
                        use: {loader: 'ts-loader'}
                    },
                ]
            },
        ]
    }
};

export default config;