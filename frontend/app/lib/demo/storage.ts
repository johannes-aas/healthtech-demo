import { USER_STORAGE_KEY } from "@/features/user/user-utils.ts";
import { SEED_USERS } from "./seed-data.ts";

/**
 * Per-visitor persistence for demo writes (notes, users, team members), in localStorage.
 *
 * Sensor data is never stored: it is regenerated on every load. Users/teams are saved (as a whole) once the visitor
 * changes them, and notes when the visitor writes one, so "Reset demo data" just removes these keys.
 */

const KEY_PREFIX = "healthtech-demo:v1:";

export type StorageKey = "users" | "notes";

/** Whether demo mode is enabled for this build. */
export const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

export function readStored<T>(key: StorageKey, isValid: (value: unknown) => value is T): T | null {
	try {
		const raw = localStorage.getItem(KEY_PREFIX + key);

		if (raw === null) {
			return null;
		}

		const value: unknown = JSON.parse(raw);
		return isValid(value) ? value : null;
	} catch (error) {
		console.warn(`Ignoring unreadable demo data for "${key}"`, error);
		return null;
	}
}

export function writeStored(key: StorageKey, value: unknown) {
	try {
		localStorage.setItem(KEY_PREFIX + key, JSON.stringify(value));
	} catch (error) {
		// E.g. storage disabled or full: the change still applies until the page is reloaded
		console.warn(`Could not save demo data for "${key}"`, error);
	}
}

/** Removes everything the visitor changed. The caller should reload the page afterwards. */
export function resetDemoData() {
	try {
		for (const key of Object.keys(localStorage)) {
			if (key.startsWith(KEY_PREFIX)) {
				localStorage.removeItem(key);
			}
		}

		// If the visitor was signed in as a user they created, that user no longer exists
		const signedInUser = localStorage.getItem(USER_STORAGE_KEY);
		const signedInUserId: unknown = signedInUser ? JSON.parse(signedInUser).id : null;

		if (typeof signedInUserId === "string" && !SEED_USERS.some((user) => user.id === signedInUserId)) {
			localStorage.removeItem(USER_STORAGE_KEY);
		}
	} catch (error) {
		console.warn("Could not reset demo data", error);
	}
}
