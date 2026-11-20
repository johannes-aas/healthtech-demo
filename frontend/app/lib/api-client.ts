import { DEFAULT_USER, USER_STORAGE_KEY } from "@/features/user/user-utils.ts";

const baseURL = import.meta.env.VITE_API_BASE_URL;

function getSignedInUserId(): string {
	try {
		const stored = localStorage.getItem(USER_STORAGE_KEY);

		if (stored) {
			return JSON.parse(stored).id;
		}
	} catch (error) {
		console.error("Failed to parse user from local storage", error);
		localStorage.removeItem(USER_STORAGE_KEY);
	}

	return DEFAULT_USER.id;
}

// NOTE: For the prototype we don't have proper authentication, so we do a make-shift solution where the client includes the signed in user ID in the query parameters of each request
export async function fetchWithUserId(path: string, init?: RequestInit): Promise<Response> {
	// Demo mode: answer every request in the browser instead of calling the backend (see lib/demo/router.ts)
	if (import.meta.env.VITE_DEMO_MODE === "true") {
		const { handleDemoRequest } = await import("./demo/router.ts");
		return handleDemoRequest(path, init, getSignedInUserId());
	}

	const url = new URL(path, baseURL);
	url.searchParams.set("signedInUserId", getSignedInUserId());

	return fetch(url.toString(), {
		...init,
		headers: {
			"Content-Type": "application/json",
			...init?.headers,
		},
	});
}
