const granted = { granted: true, status: "granted", canAskAgain: true, expires: "never" };

export const requestMediaLibraryPermissionsAsync = jest.fn(async () => granted);
export const requestCameraPermissionsAsync = jest.fn(async () => granted);
export const launchImageLibraryAsync = jest.fn(async () => ({ canceled: true, assets: null }));
export const launchCameraAsync = jest.fn(async () => ({ canceled: true, assets: null }));
