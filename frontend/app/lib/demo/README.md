# Demo mode

A browser-only version of the app: no backend or database. Every API call is answered in the browser, with sensor
data generated on the fly. It can be hosted as a static site (Netlify, Cloudflare Pages, …).

## Enabling it

Set `VITE_DEMO_MODE=true` at build time (or in `frontend/.env` for `pnpm run dev`). Without the flag, the app talks to
the backend exactly as before, and none of the demo code ends up in the bundle. In demo mode `VITE_API_BASE_URL` is
not used (the backend branch is removed from the bundle), so any placeholder will do.

```sh
cd frontend
VITE_DEMO_MODE=true VITE_API_BASE_URL=https://example.invalid/api/ pnpm run build
npx serve -s build/client   # try it locally
```

Deploy `frontend/build/client`. `public/_redirects` (`/*  /index.html  200`) makes deep links work on Netlify and
Cloudflare Pages.

| Setting           | Value                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| Base directory    | `frontend`                                                                  |
| Build command     | `pnpm run build`                                                            |
| Publish directory | `build/client`                                                              |
| Environment       | `VITE_DEMO_MODE=true`, `VITE_API_BASE_URL=https://example.invalid/api/`     |

## How it works

`fetchWithUserId` in `lib/api-client.ts` hands every request to `router.ts`, which mirrors the backend routes. The
modules here are ports of the backend, named after the C# they come from:

| File                                                   | Backend                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| `exposure-controller.ts`, `exposure-service.ts`        | `ExposureDataController`, `ExposureDataService`, `ExposureUtils` |
| `user-controller.ts`, `user-service.ts`                | `UserController`, `UserService`                               |
| `user-status-service.ts`                               | `UserStatusService`                                           |
| `note-controller.ts`, `note-service.ts`                | `NoteDataController`, `NoteDataService`                       |
| `backend-utils.ts`                                     | `AuthorizationUtils`, `TimeWindowUtils`, `ThresholdUtils`     |
| `seed-data.ts`                                         | `DatabaseSeeder`, `SeedIds` (smaller team, see below)         |
| `views.ts`, `buckets.ts`                               | The TimescaleDB materialized views (`time_bucket`, UTC)       |

Sensor data (`generator.ts`, `time.ts`, `calibration.ts`):

- Weekdays from the start of the month two months ago, 07:00–15:00 UTC (08:00–16:00 Norwegian time in winter) with a
  sample every 30 s, like the sample data. Today is the same, but stops at the current time while the shift is going,
  so "live" and "today" are empty before the shift, in the evening and at weekends.
- Deterministic: values are a hash of user, sample time and stream (`random.ts`), so every visitor sees the same data,
  and it is generated lazily per user and day, then cached.
- Each day gets a target level per exposure (noise day average, dust day average, vibration day total), drawn from
  tables in `calibration.ts` and shifted by the operator's profile (`profiles.ts`). The samples are generated around
  it: noise as work bursts over a quiet background, dust drifting from hour to hour, vibration as tool connections.
- Timing and signal shapes come from summary statistics of the original sample CSVs (`scripts/sensor_data_stats.py`);
  the levels are balanced by hand, since the sample data is far more extreme. Across the team, about half of all days
  are within safe limits, a bit under half above the action value, and a few percent above the limit value.
- Only the operators have data; the foreman (Ola) has none.

Writes (notes, users, team members) are stored per visitor in localStorage (`storage.ts`). "Reset demo data" in the
DEMO box of the user menu removes them.

## Deliberate differences from the backend

- **Hour domain**: the lowest/highest hour across all timestamps, instead of the hours of the earliest/latest timestamp,
  which cuts off the current week when data runs up to the current time.
- **Notes**: times with a non-UTC offset are accepted. The frontend sends Oslo-offset times, which the backend rejects.
- **Vibration status over a range** (foreman week view): the highest single-day total in the range, compared with the
  daily limits. The backend sums the whole range against the daily limits, so a normal week is "above the limit value".
- **Team**: 5 operators instead of the seeded 8 (Birgir, Torleif and Bjørnulf are left out).
- **Sensor data levels**: balanced per operator profile instead of the seed's random multipliers of the sample data.
- Passwords are not stored, and new users' `createdAt`/seed users' `createdAt` are set by the demo.

Everything else, including quirks, follows the C#: e.g. the foreman 7-day limit, `count` on noise/dust failing with a
500, and an empty threshold summary for a foreman without a team.
