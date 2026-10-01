import { useEffect } from "react";
import * as Sentry from "@sentry/react-native";
import { useNavigationContainerRef } from "expo-router";

const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const navigationIntegration = Sentry.reactNavigationIntegration({ enableTimeToInitialDisplay: true });

export function initMonitoring(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    sendDefaultPii: false,
    enableAutoSessionTracking: true,
    enableAppHangTracking: true,
    enableWatchdogTerminationTracking: true,
    attachScreenshot: true,
    tracesSampleRate: __DEV__ ? 1 : 0.2,
    integrations: [navigationIntegration],
  });
}

export function useMonitoredNavigation(): void {
  const ref = useNavigationContainerRef();
  useEffect(() => {
    if (dsn && ref) navigationIntegration.registerNavigationContainer(ref);
  }, [ref]);
}

export const withMonitoring: typeof Sentry.wrap = (component, options) => (dsn ? Sentry.wrap(component, options) : component);
export const captureException = Sentry.captureException;
