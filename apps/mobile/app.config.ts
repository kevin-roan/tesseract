import { existsSync } from 'node:fs';
import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * App variants. `APP_VARIANT=development` gives the dev client its own bundle
 * identifier, package, name and icon badge so it can sit next to the production
 * build on the same device. EAS sets it per build profile (eas.json `env`) and per
 * environment (`eas env`), `expo start` reads it from `.env.development`.
 *
 * The app group `group.com.kevinroan.tesseract` and the `tesseract://` scheme are
 * shared on purpose: the controller mints `tesseract://pair` links and the island
 * and share extensions hardcode the group.
 */
const VARIANT = process.env.APP_VARIANT ?? 'production';
const IS_DEV = VARIANT === 'development';

const BASE_ID = 'com.kevinroan.tesseract';

const LOCAL_GOOGLE_SERVICES = './google-services.json';

const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync(LOCAL_GOOGLE_SERVICES) ? LOCAL_GOOGLE_SERVICES : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  name: IS_DEV ? `${config.name} Dev` : (config.name ?? 'Tesseract'),
  ios: {
    ...config.ios,
    bundleIdentifier: IS_DEV ? `${BASE_ID}.dev` : BASE_ID,
  },
  android: {
    ...config.android,
    package: IS_DEV ? `${BASE_ID}.dev` : BASE_ID,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
});
