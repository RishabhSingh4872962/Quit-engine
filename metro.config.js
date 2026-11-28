// https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Native builds leave thousands of Gradle output folders in node_modules/*/android/build. Metro never
// needs them, and watching them can use up the system's file watchers (ENOSPC), so they are skipped.
config.resolver.blockList = [
  ...[config.resolver.blockList].flat().filter(Boolean),
  /[\\/]node_modules[\\/].+[\\/]android[\\/]build([\\/].*)?$/,
];

module.exports = config;
