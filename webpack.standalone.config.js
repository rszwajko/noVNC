import path from 'path';
import HtmlBundlerPlugin from 'html-bundler-webpack-plugin';


const ENTRY_FILE =`
import html from "./index.html?raw";
export default html;
`;
class CreateEntryPoint {
    apply(compiler) {
        const pluginName = "CreateEntryPoint";
        const { webpack } = compiler;

        compiler.hooks.thisCompilation.tap(pluginName, (compilation) => {
            compilation.hooks.processAssets.tap(
                {
                    name: pluginName,
                    stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
                },
                (assets) => {
                    compilation.emitAsset(
                        'standalone.js',
                        new webpack.sources.RawSource(ENTRY_FILE),
                        {        minimized: true,           });

                });
        });
    }
}


const config = {
    mode: 'production',
    output: {
        path: path.resolve(import.meta.dirname, 'standalone'),
        clean: true,
    },

    plugins: [
        new HtmlBundlerPlugin({
            entry: {
                index: './vnc.html',
            },
            js: {
                inline: true, // inline JS into HTML
            },
            css: {
                inline: true, // inline CSS into HTML
            },
        }),
        new CreateEntryPoint()
    ],

    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [ 'css-loader'],
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif|ico|mp3|oga|ttf|woff)$/i,
                type: 'asset/inline', // inline all images into HTML/CSS
            },
        ],
    },
};

export default config;