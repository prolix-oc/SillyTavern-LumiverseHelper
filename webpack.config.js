const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");

module.exports = (env, argv) => {
  const isDev = argv.mode === "development";

  return {
    entry: path.join(__dirname, "src/index.js"),
    output: {
      path: path.join(__dirname, "dist"),
      filename: "index.js",
      // No library export - we expose globals manually via globalThis
    },
    resolve: {
      extensions: [".js", ".jsx"],
      alias: {
        "@lib": path.resolve(__dirname, "src/lib"),
        "@react": path.resolve(__dirname, "src/react-ui"),
        "@helpers": path.resolve(__dirname, "src/sthelpers"),
        // Ensure single React instance within the bundle (prevents Error #158)
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      },
    },

    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
              presets: [
                "@babel/preset-env",
                ["@babel/preset-react", { runtime: "automatic" }],
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    optimization: {
      minimize: !isDev,
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            format: {
              comments: false,
            },
            mangle: {
              // CRITICAL: Preserve generation interceptor global name
              reserved: ["lumiverseHelperGenInterceptor"],
            },
          },
        }),
      ],
    },
    devtool: isDev ? "eval-source-map" : false,
    watchOptions: {
      ignored: /node_modules/,
    },
  };
};
