const { withInfoPlist, withAndroidManifest } = require('expo/config-plugins');

/**
 * Expo config plugin that enables HTTP (cleartext) traffic on iOS and Android.
 *
 * iOS: Sets NSAllowsArbitraryLoads = true in NSAppTransportSecurity (Info.plist).
 * Android: Sets android:usesCleartextTraffic="true" on the <application> element
 *          (AndroidManifest.xml). Required because Android 9+ (API 28+) blocks
 *          cleartext HTTP by default.
 *
 * Both modifiers run AFTER expo prebuild generates the native files, guaranteeing
 * the settings are not overwritten by other plugins.
 *
 * TODO: Remove this plugin once the backend is served over HTTPS (both iOS and Android).
 */

function withIosCleartextHttp(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSAppTransportSecurity = {
      ...(cfg.modResults.NSAppTransportSecurity || {}),
      NSAllowsArbitraryLoads: true,
    };
    console.log('[allow-http] iOS: NSAllowsArbitraryLoads set to true');
    return cfg;
  });
}

function withAndroidCleartextHttp(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest.application[0];
    application.$['android:usesCleartextTraffic'] = 'true';
    console.log('[allow-http] Android: android:usesCleartextTraffic set to true');
    return cfg;
  });
}

module.exports = function allowHttpPlugin(config) {
  config = withIosCleartextHttp(config);
  config = withAndroidCleartextHttp(config);
  return config;
};
