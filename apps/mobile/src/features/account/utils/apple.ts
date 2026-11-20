import * as AppleAuthentication from "expo-apple-authentication";

import { ControlHeight, type SystemScheme } from "@/theme";

import type { AuthMode } from "./form";

export const APPLE_BUTTON_HEIGHT = ControlHeight.lg;

export const APPLE_BUTTON_RADIUS = APPLE_BUTTON_HEIGHT / 2;

export const APPLE_BUTTON_TYPE: Record<AuthMode, AppleAuthentication.AppleAuthenticationButtonType> = {
  signIn: AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN,
  signUp: AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP,
};

export const APPLE_BUTTON_STYLE: Record<SystemScheme, AppleAuthentication.AppleAuthenticationButtonStyle> = {
  dark: AppleAuthentication.AppleAuthenticationButtonStyle.WHITE,
  light: AppleAuthentication.AppleAuthenticationButtonStyle.BLACK,
};
