import { z } from "zod";

/** The user's theme choice. "system" follows the macOS appearance. */
export const ThemePreference = z.enum(["system", "light", "dark"]);

/** The user's theme choice. */
export type ThemePreference = z.infer<typeof ThemePreference>;

const STORAGE_KEY = "steinbeck.theme";

/**
 * Reads the saved theme choice. A missing or unknown value means "system".
 *
 * @example
 * ```ts
 * const [pref, setPref] = createSignal(loadThemePreference());
 * ```
 */
export function loadThemePreference(): ThemePreference {
  const parsed = ThemePreference.safeParse(localStorage.getItem(STORAGE_KEY));
  return parsed.success ? parsed.data : "system";
}

/**
 * Saves the theme choice for the next launch.
 *
 * @example
 * ```ts
 * saveThemePreference("dark");
 * ```
 */
export function saveThemePreference(preference: ThemePreference): void {
  localStorage.setItem(STORAGE_KEY, preference);
}

/**
 * Decides if the UI is dark.
 *
 * @example
 * ```ts
 * isDark("system", matchMedia("(prefers-color-scheme: dark)").matches);
 * ```
 */
export function isDark(preference: ThemePreference, systemDark: boolean): boolean {
  return preference === "system" ? systemDark : preference === "dark";
}
