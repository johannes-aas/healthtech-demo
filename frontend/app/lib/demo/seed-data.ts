import type { UserRole } from "@/lib/dto/user.ts";

/**
 * Static seed data, ported from `backend/src/Services/DatabaseSeeder.cs` and `SeedIds.cs`.
 * IDs must stay identical to the backend so that e.g. `DEFAULT_USER` and the IDs in `user-utils.ts` keep working.
 *
 * DEMO DEVIATION: the demo team is smaller than the seeded one (5 operators instead of 8); Birgir, Torleif and
 * Bjørnulf are left out.
 */

export type SeedLocation = {
	id: string;
	site: string;
	building: string | null;
	country: string;
	region: string;
	city: string;
	latitude: number;
	longitude: number;
};

export type SeedUser = {
	id: string;
	name: string;
	email: string;
	jobDescription: string | null;
	role: UserRole;
	locationId: string;
};

// SeedIds.cs
const SEED_IDS = {
	kari: "87654321-8765-4321-8765-432187654321",
	ola: "12345678-1234-5678-1234-567812345678",
	per: "aaa3801e-f3ff-4b0c-9692-56e7505e9c31",
	verdalLocation: "11111111-1111-1111-1111-111111111111",
	sandsliLocation: "22222222-2222-2222-2222-222222222222",
} as const;

// Private IDs in DatabaseSeeder.cs
const TROND_ID = "bbb3801e-f3ff-4b0c-9692-56e7505e9c31";
const GJERTRUD_ID = "ccc3801e-f3ff-4b0c-9692-56e7505e9c32";
const KLARA_ID = "ccc3801e-f3ff-4b0c-9692-56e7505e9c33";

export const SEED_LOCATIONS: Array<SeedLocation> = [
	{
		id: SEED_IDS.verdalLocation,
		site: "Aker Solutions Verdal",
		building: "M-hallen",
		country: "Norway",
		region: "Trøndelag",
		latitude: 63.78788207165566,
		longitude: 11.440749156413084,
		city: "Verdal",
	},
	{
		id: SEED_IDS.sandsliLocation,
		site: "Aker Solutions Sandsli",
		building: "Bygg 1",
		country: "Norway",
		region: "Bergen",
		latitude: 60.29278334510331,
		longitude: 5.279473042646057,
		city: "Bergen",
	},
];

// Same order as the seeder inserts them, which is also the order `GET /users` returns them in (no ORDER BY).
export const SEED_USERS: Array<SeedUser> = [
	{
		id: SEED_IDS.ola,
		name: "Ola Nordmann",
		email: "ola.nordmann@aker.com",
		jobDescription: "Formann for bygg 1",
		locationId: SEED_IDS.verdalLocation,
		role: "foreman",
	},
	{
		id: SEED_IDS.kari,
		name: "Kari Nordmann",
		email: "kari.nordmann@aker.com",
		jobDescription: "Sveiser",
		locationId: SEED_IDS.verdalLocation,
		role: "operator",
	},
	{
		id: SEED_IDS.per,
		name: "Per Hansen",
		email: "per.hansen@aker.com",
		jobDescription: "Technician",
		locationId: SEED_IDS.verdalLocation,
		role: "operator",
	},
	{
		id: TROND_ID,
		name: "Trond Pedersen",
		email: "trond.pedersen@aker.com",
		jobDescription: "Technician",
		locationId: SEED_IDS.verdalLocation,
		role: "operator",
	},
	{
		id: GJERTRUD_ID,
		name: "Gjertrud Olsen",
		email: "gjertrud.olsen@aker.com",
		jobDescription: "Technician",
		locationId: SEED_IDS.verdalLocation,
		role: "operator",
	},
	{
		id: KLARA_ID,
		name: "Klara Johansen",
		email: "klara.johansen@aker.com",
		jobDescription: "Technician",
		locationId: SEED_IDS.verdalLocation,
		role: "operator",
	},
];

export type ManagerLink = {
	managerId: string;
	subordinateId: string;
};

export const SEED_MANAGER_LINKS: Array<ManagerLink> = [
	SEED_IDS.kari,
	SEED_IDS.per,
	TROND_ID,
	GJERTRUD_ID,
	KLARA_ID,
].map((subordinateId) => ({ managerId: SEED_IDS.ola, subordinateId }));

export const SEED_USER_IDS = {
	kari: SEED_IDS.kari,
	per: SEED_IDS.per,
	trond: TROND_ID,
	gjertrud: GJERTRUD_ID,
	klara: KLARA_ID,
} as const;
