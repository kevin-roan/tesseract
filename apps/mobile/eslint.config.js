// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
  {
    files: ["tests/**/*.{js,ts,tsx}"],
    languageOptions: {
      globals: { jest: "readonly" },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["tests/e2e/scripts/**/*.js"],
    languageOptions: {
      globals: {
        http: "readonly",
        json: "readonly",
        output: "writable",
        ACTION: "readonly",
        TESSERACT_URL: "readonly",
        TESSERACT_TOKEN: "readonly",
      },
    },
    rules: {
      "no-var": "off",
    },
  },
]);
