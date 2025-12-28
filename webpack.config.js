const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  // Define the entry point for the application (यह 'src/index.js' को देखता है)
  entry: './src/index.js',
  
  // Define where the bundled output should go
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/'
  },
  
  // Set up the development server
  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3003,
    historyApiFallback: true, // Allows refreshing pages that are not root
  },
  
  // Module rules (how to handle different file types)
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react']
          }
        }
      },
      {
        test: /\.css$/,
        // PostCSS-Loader को Tailwind और Autoprefixer के लिए जोड़ना
        use: ['style-loader', 'css-loader', 'postcss-loader'] 
      }
    ]
  },
  
  // Resolve extensions so we can import 'App' instead of 'App.jsx'
  resolve: {
    extensions: ['.js', '.jsx']
  },

  // Plugins to manage HTML file generation
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html', // Use our custom HTML template
      filename: 'index.html',
      inject: 'body',
    })
  ]
};