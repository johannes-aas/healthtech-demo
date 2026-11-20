import type { DangerLevel } from "@/lib/danger-levels.ts";
import type { UserRole } from "@/lib/dto/user.ts";
import {
	type ManagerLink,
	SEED_LOCATIONS,
	SEED_MANAGER_LINKS,
	SEED_USERS,
	type SeedLocation,
	type SeedUser,
} from "./seed-data.ts";
import { internalServerError } from "./http.ts";
import { hasSensorData } from "./profiles.ts";
import { readStored, writeStored } from "./storage.ts";
import { getDataStart } from "./time.ts";

/**
 * Port of `backend/src/Services/UserService.cs` and the DTO mapping in `Controllers/DTOs/UserDTOs`.
 * Starts from the seed data; once the visitor changes something, the whole user state is saved in localStorage.
 */

export type DemoUser = SeedUser & {
	/** ISO string, like the backend's `CreatedAt` (UTC). */
	createdAt: string;
};

type UserState = {
	users: Array<DemoUser>;
	managerLinks: Array<ManagerLink>;
};

// --- Wire formats (what the backend serializes) ---

type LocationDto = {
	id: string;
	latitude: number;
	longitude: number;
	country: string;
	region: string;
	city: string;
	site: string;
	building: string | null;
};

export type UserDto = {
	id: string;
	name: string;
	email: string;
	jobDescription: string | null;
	createdAt: string;
	role: UserRole;
	location: LocationDto | null;
};

export type UserExposureStatusDto = {
	dangerLevel: DangerLevel;
	peakDangerLevel: DangerLevel | null;
	value: number;
	peakValue: number | null;
};

export type UserStatusDto = {
	userId: string;
	status: DangerLevel;
	noise: UserExposureStatusDto | null;
	dust: UserExposureStatusDto | null;
	vibration: UserExposureStatusDto | null;
};

export type UserWithStatusDto = UserDto & { status: UserStatusDto };

// --- State ---

let state: UserState | null = null;

function createSeedState(): UserState {
	// The seeder uses `DateTime.UtcNow` at seed time, we use the start of the generated data instead
	const createdAt = new Date(getDataStart()).toISOString();

	return {
		users: SEED_USERS.map((user) => ({ ...user, createdAt })),
		managerLinks: SEED_MANAGER_LINKS.map((link) => ({ ...link })),
	};
}

function isUserState(value: unknown): value is UserState {
	const candidate = value as Partial<UserState> | null;
	return Array.isArray(candidate?.users) && Array.isArray(candidate.managerLinks);
}

function getUserState(): UserState {
	state ??= readStored("users", isUserState) ?? createSeedState();
	return state;
}

function saveUserState() {
	writeStored("users", getUserState());
}

// --- Queries (UserService) ---

export function getAllUsers(): Array<DemoUser> {
	return getUserState().users;
}

export function getUserById(id: string): DemoUser | undefined {
	return getUserState().users.find((user) => user.id === id);
}

/**
 * `SignedInUserMiddleware`: the `signedInUserId` query parameter is looked up if it is a valid GUID.
 * NOTE: Like the prototype backend, this is not authentication, just a way to know the user's role.
 */
export function getSignedInUser(signedInUserId: string): DemoUser | undefined {
	return getUserById(signedInUserId.toLowerCase());
}

/** `GetSubordinatesAsync`: users that have `managerId` as one of their managers, ordered by name. */
export function getSubordinates(managerId: string): Array<DemoUser> {
	const { users, managerLinks } = getUserState();
	const subordinateIds = new Set(
		managerLinks.filter((link) => link.managerId === managerId).map((link) => link.subordinateId),
	);

	return users
		.filter((user) => subordinateIds.has(user.id))
		.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "variant" }));
}

// --- DTO mapping ---

/**
 * `LocationDto.Latitude/Longitude` are C# `float`s, so the backend serializes them with single precision
 * (shortest representation that round-trips to the same float).
 */
function toFloat32Json(value: number): number {
	const single = Math.fround(value);

	for (let precision = 1; precision <= 9; precision++) {
		const candidate = Number(single.toPrecision(precision));
		if (Math.fround(candidate) === single) {
			return candidate;
		}
	}

	return single;
}

function toLocationDto(location: SeedLocation): LocationDto {
	return {
		id: location.id,
		latitude: toFloat32Json(location.latitude),
		longitude: toFloat32Json(location.longitude),
		country: location.country,
		region: location.region,
		city: location.city,
		site: location.site,
		building: location.building,
	};
}

export function toUserDto(user: DemoUser): UserDto {
	const location = SEED_LOCATIONS.find((candidate) => candidate.id === user.locationId);

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		jobDescription: user.jobDescription,
		createdAt: user.createdAt,
		role: user.role,
		location: location ? toLocationDto(location) : null,
	};
}

export function toUserWithStatusDto(user: DemoUser, status: UserStatusDto): UserWithStatusDto {
	return { ...toUserDto(user), status };
}

// --- Writes (UserService) ---

// `UserRole` enum values: higher can manage lower (`UserRoleExtensions.CanManage`)
const ROLE_RANK: Record<UserRole, number> = { operator: 0, foreman: 10 };

const canManage = (managerRole: UserRole, subordinateRole: UserRole) =>
	ROLE_RANK[managerRole] > ROLE_RANK[subordinateRole];

/** `CreateUserAsync`. Note: like the backend, the given manager IDs are not used. */
export function createUser(input: {
	name: string;
	email: string;
	jobDescription: string | null;
	locationId: string;
	role: UserRole;
}): DemoUser {
	if (!SEED_LOCATIONS.some((location) => location.id === input.locationId)) {
		// Foreign key violation in the backend
		throw internalServerError();
	}

	const user: DemoUser = { id: crypto.randomUUID(), ...input, createdAt: new Date().toISOString() };
	getUserState().users.push(user);
	saveUserState();

	return user;
}

/** `UpdateUserAsync`: only name, email and job description are applied (the password isn't stored in the demo). */
export function updateUser(
	id: string,
	input: { name?: string | null; email?: string | null; jobDescription?: string | null },
): DemoUser | null {
	const user = getUserById(id);

	if (!user) {
		return null;
	}

	user.name = input.name ?? user.name;
	user.email = input.email ?? user.email;
	user.jobDescription = input.jobDescription ?? user.jobDescription;
	saveUserState();

	return user;
}

/**
 * `DeleteUserAsync`. Manager links (and notes, see `note-service.ts`) cascade, but sensor data is
 * `DeleteBehavior.Restrict`, so users with sensor data can't be deleted (a 500 in the backend).
 */
export function deleteUser(id: string): boolean {
	const userState = getUserState();
	const user = getUserById(id);

	if (!user) {
		return false;
	}

	if (hasSensorData(id)) {
		throw internalServerError();
	}

	userState.users = userState.users.filter((candidate) => candidate.id !== id);
	userState.managerLinks = userState.managerLinks.filter(
		(link) => link.managerId !== id && link.subordinateId !== id,
	);
	saveUserState();

	return true;
}

/** `UpdateSubordinatesAsync`: replaces the manager's subordinates. Returns null (a 404) if the list isn't valid. */
export function updateSubordinates(managerId: string, subordinateIds: Array<string>): DemoUser | null {
	const userState = getUserState();
	const manager = getUserById(managerId);

	if (!manager) {
		return null;
	}

	const newSubordinates = userState.users.filter((user) => subordinateIds.includes(user.id));

	if (subordinateIds.length > 0) {
		if (newSubordinates.length !== new Set(subordinateIds).size) {
			return null;
		}

		if (newSubordinates.some((user) => user.id === managerId)) {
			return null;
		}

		if (!newSubordinates.every((user) => canManage(manager.role, user.role))) {
			return null;
		}
	}

	userState.managerLinks = [
		...userState.managerLinks.filter((link) => link.managerId !== managerId),
		...newSubordinates.map((user) => ({ managerId, subordinateId: user.id })),
	];
	saveUserState();

	return manager;
}
