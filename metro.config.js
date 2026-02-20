const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })

// Allow .html files to be required as static assets
config.resolver.assetExts.push('html')
    