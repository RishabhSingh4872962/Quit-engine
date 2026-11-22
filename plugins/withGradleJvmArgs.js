const { withGradleProperties } = require('expo/config-plugins');

/**
 * Sets org.gradle.jvmargs in the generated android/gradle.properties.
 * Expo's default 2 GB heap runs out in the dex merge step now that the app
 * includes Firebase, RevenueCat and other native libraries.
 */
module.exports = function withGradleJvmArgs(config, { jvmArgs }) {
  return withGradleProperties(config, (cfg) => {
    cfg.modResults = cfg.modResults.filter((p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'));
    cfg.modResults.push({ type: 'property', key: 'org.gradle.jvmargs', value: jvmArgs });
    return cfg;
  });
};
