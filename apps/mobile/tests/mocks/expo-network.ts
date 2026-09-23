export const getNetworkStateAsync = jest.fn(async () => ({ isConnected: true, isInternetReachable: true }));
export const addNetworkStateListener = jest.fn(() => ({ remove: jest.fn() }));
