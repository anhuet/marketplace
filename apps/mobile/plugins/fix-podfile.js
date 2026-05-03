const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Expo config plugin that patches the generated Podfile to fix known
 * compatibility issues with React Native 0.74 + Expo SDK 51.
 *
 * Problem:
 *   ExpoModulesCore (Swift) depends on React-jsinspector (C++).
 *   Swift can only import C++ pods that expose a module map.
 *   → React-jsinspector needs modular headers enabled.
 *
 *   But enabling `use_modular_headers!` globally causes the ReactCommon
 *   pod (which already sets `s.module_name = "ReactCommon"` in its podspec)
 *   to get a SECOND auto-generated module map from CocoaPods, resulting in:
 *     "redefinition of module 'ReactCommon'"
 *
 * Solution:
 *   Remove the global `use_modular_headers!` and instead selectively enable
 *   modular headers only for the pods that Swift code needs to import.
 *   This is done via `pod 'X', :modular_headers => true` in a pre_install
 *   hook that patches the pod specs.
 */
module.exports = function fixPodfilePlugin(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (fs.existsSync(podfilePath)) {
        let contents = fs.readFileSync(podfilePath, 'utf8');

        // Remove :privacy_file_aggregation_enabled (requires CocoaPods >= 1.15.2)
        contents = contents.replace(/.*:privacy_file_aggregation_enabled.*\n?/g, '');

        // Remove any standalone pod 'React-jsinspector' lines that would conflict
        // with autolinking (which provides it from node_modules with :path source)
        contents = contents.replace(/^\s*pod\s+'React-jsinspector'(?!.*:path).*\n?/gm, '');

        // Remove global use_modular_headers! — causes "redefinition of module 'ReactCommon'"
        contents = contents.replace(/^\s*use_modular_headers!\s*\n?/m, '');

        // Insert a pre_install hook that selectively enables modular headers
        // only for pods that Swift code (ExpoModulesCore) needs to import.
        // This generates module maps for these specific pods without affecting ReactCommon.
        if (!contents.includes('defines_module')) {
          const preInstallHook = `
# Selective modular headers: only enable for pods that Swift code needs to import.
# This avoids the global use_modular_headers! which causes ReactCommon redefinition.
pre_install do |installer|
  installer.pod_targets.each do |pod|
    if ['React-jsinspector'].include?(pod.name)
      pod.root_spec.attributes_hash['pod_target_xcconfig'] ||= {}
      pod.root_spec.attributes_hash['pod_target_xcconfig']['DEFINES_MODULE'] = 'YES'
    end
  end
end
`;
          // Insert before the first `target` declaration
          contents = contents.replace(
            /^(target\s+['"])/m,
            preInstallHook + '$1'
          );
        }

        fs.writeFileSync(podfilePath, contents, 'utf8');
        console.log('[fix-podfile] Patched Podfile successfully');
      }
      return cfg;
    },
  ]);
};
