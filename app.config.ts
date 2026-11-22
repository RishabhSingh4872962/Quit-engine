import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json holds the config; this only fills in files that are kept out of git.
 * EAS cloud builds get google-services.json from a file environment variable:
 *   eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --environment production
 * Local builds use ./google-services.json.
 */
export default ({ config }: ConfigContext): ExpoConfig =>
  ({
    ...config,
    android: {
      ...config.android,
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? config.android?.googleServicesFile,
    },
  }) as ExpoConfig;
