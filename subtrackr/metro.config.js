const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Tell Expo's watcher to completely ignore the Tauri folder
// so it doesn't crash when Rust creates temporary build files.
config.resolver.blockList = [
  /\/src-tauri\/.*/,
];

module.exports = withNativeWind(config, { input: "./global.css" });