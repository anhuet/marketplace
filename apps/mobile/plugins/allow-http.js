const { withInfoPlist } = require('expo/config-plugins');

/**
 * Expo config plugin that enables HTTP (cleartext) traffic on iOS.
 *
 * Sets NSAllowsArbitraryLoads = true in NSAppTransportSecurity.
 * This runs AFTER expo prebuild generates Info.plist, guaranteeing
 * the setting is not overwritten by other plugins.
 *
 * TODO: Remove this plugin once the backend is served over HTTPS.
 */
module.exports = function allowHttpPlugin(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSAppTransportSecurity = {
      ...(cfg.modResults.NSAppTransportSecurity || {}),
      NSAllowsArbitraryLoads: true,
    };
    console.log('[allow-http] NSAllowsArbitraryLoads set to true');
    return cfg;
  });
};
