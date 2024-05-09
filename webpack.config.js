module.exports = {
  mode: "production",
  entry: "./src/index.js",
  output: {
    filename: "bundle.min.js",
    path: __dirname + "/dist",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/, // Handling JS and JSX files
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-react"],
          },
        },
      },
      {
        test: /\.css$/, // Handling CSS files
        use: ["style-loader", "css-loader"], // Apply both loaders
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"], // Resolvable extensions
  },
};
