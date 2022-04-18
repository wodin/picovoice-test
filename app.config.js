function app_variant(base, dev, preview) {
  switch (process.env.APP_VARIANT) {
    case "development":
      return `${base}${dev}`;
    case "preview":
      return `${base}${preview}`;
    default:
      return base;
  }
}

export default function ({ config }) {
  return {
    ...config,
    name: app_variant(config.name, " (Dev)", " (Preview)"),
    android: {
      ...config.android,
      package: app_variant(config.android.package, ".dev", ".preview"),
    },
    ios: {
      ...config.ios,
      bundleIdentifier: app_variant(config.ios.bundleIdentifier, ".dev", ".preview"),
    },
  };
}
