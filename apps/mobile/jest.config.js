module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "\\.css$": "<rootDir>/tests/mocks/style-mock.js",
    "^@/assets/(.*)$": "<rootDir>/assets/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^expo-secure-store$": "<rootDir>/tests/mocks/expo-secure-store.ts",
    "^expo-sqlite/kv-store$": "<rootDir>/tests/mocks/expo-sqlite-kv-store.ts",
    "^expo-camera$": "<rootDir>/tests/mocks/expo-camera.tsx",
    "^expo-network$": "<rootDir>/tests/mocks/expo-network.ts",
    "^react-native-webview$": "<rootDir>/tests/mocks/react-native-webview.tsx",
  },
  testMatch: ["<rootDir>/tests/**/*.test.{ts,tsx}"],
};
