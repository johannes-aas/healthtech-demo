import { notFound, parseGuid } from "./http.ts";
import type { DemoRequest } from "./router.ts";
import {
	getAllUsers,
	getSubordinates,
	getUserById,
	toUserDto,
	toUserWithStatusDto,
	type UserDto,
	type UserStatusDto,
	type UserWithStatusDto,
} from "./user-service.ts";

/**
 * Port of `backend/src/Controllers/UserController.cs`.
 */

// GET users
export function getAllUsersAction(): Array<UserDto> {
	return getAllUsers().map(toUserDto);
}

// GET users/{id}
export function getUserByIdAction({ params }: DemoRequest): UserDto {
	const user = getUserById(parseGuid(params.id));

	if (!user) {
		throw notFound();
	}

	return toUserDto(user);
}

// GET users/{managerId}/subordinates
export function getSubordinatesAction({ params }: DemoRequest): Array<UserWithStatusDto> {
	const subordinates = getSubordinates(parseGuid(params.id));

	// TODO(demo step 5): compute statuses with the port of UserStatusService
	const userStatuses: Array<UserStatusDto> = [];

	return subordinates.map((user) => {
		const status = userStatuses.find((candidate) => candidate.userId === user.id);

		return toUserWithStatusDto(
			user,
			status ?? { userId: user.id, status: "safe", noise: null, dust: null, vibration: null },
		);
	});
}
