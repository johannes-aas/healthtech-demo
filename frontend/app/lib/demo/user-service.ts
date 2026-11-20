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
import { getDataStart } from "./time.ts";

/**
 * Port of `backend/src/Services/UserService.cs` (read side) and the DTO mapping in `Controllers/DTOs/UserDTOs`.
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

export function getUserState(): UserState {
	state ??= createSeedState();
	return state;
}

// --- Queries (UserService) ---

export function getAllUsers(): Array<DemoUser> {
	return getUserState().users;
}

export function getUserById(id: string): DemoUser | undefined {
	return getUserState().users.find((user) => user.id === id);
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
