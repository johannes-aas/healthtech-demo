"""Summary statistics of the sample sensor CSVs, used to calibrate the demo data generator (../calibration.ts).

Prints only aggregates (shares, rates and percentiles), never individual rows.
Needs Python 3.9+ and no third-party packages.

Usage:
    python3 -I frontend/app/lib/demo/scripts/sensor_data_stats.py <dir with NoiseData.csv, DustData.csv, VibrationData.csv>
"""

import csv
import statistics
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone

LOUD_DAY_MEAN_LAEQ = 75  # Days with a mean LAEQ above this are "loud" (the distribution is clearly bimodal)
DUSTY_DAY_MEAN_PM1_TWA = 10  # Same for dust
PEAK_DB = 100  # Noise samples at or above this are peaks
QUANTILES = [0, 0.02, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.92, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1]


def parse_time(value):
    value = value.strip().replace("Z", "+00:00")
    if " " in value and "T" not in value:
        value = value.replace(" ", "T", 1)
    parsed = datetime.fromisoformat(value)
    return (parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)


def quantile_table(values, quantiles=QUANTILES):
    ordered = sorted(values)
    last = len(ordered) - 1
    pairs = ", ".join(f"[{q:g}, {ordered[round(q * last)]:.4g}]" for q in quantiles)
    return f"[{pairs}]"


def share(count, total):
    return f"{count / total:.4f}"


def shift_summary(times):
    by_day = defaultdict(list)
    for time in times:
        by_day[time.date()].append(time)
    starts = Counter(min(day).strftime("%H:%M") for day in by_day.values())
    ends = Counter(max(day).strftime("%H:%M:%S") for day in by_day.values())
    intervals = Counter(
        round((b - a).total_seconds()) for a, b in zip(sorted(times), sorted(times)[1:]) if a.date() == b.date()
    )
    print(f"  days: {len(by_day)}, weekdays: {dict(Counter(d.strftime('%a') for d in by_day))}")
    print(f"  first sample (UTC): {starts.most_common(3)}, last sample (UTC): {ends.most_common(3)}")
    print(f"  sample interval (s): {intervals.most_common(3)}")


def noise(directory):
    print("NOISE")
    days = defaultdict(list)
    with open(f"{directory}/NoiseData.csv", newline="") as file:
        for row in csv.DictReader(file):
            days[parse_time(row["Time"])].append((float(row["LAEQ"]), float(row["LCPK"])))
    shift_summary(list(days))

    by_date = defaultdict(list)
    for time, samples in days.items():
        by_date[time.date()].extend(samples)
    day_means = {date: statistics.fmean(laeq for laeq, _ in samples) for date, samples in by_date.items()}
    loud = [samples for date, samples in by_date.items() if day_means[date] >= LOUD_DAY_MEAN_LAEQ]
    quiet = [samples for date, samples in by_date.items() if day_means[date] < LOUD_DAY_MEAN_LAEQ]
    all_samples = [sample for samples in by_date.values() for sample in samples]
    quiet_samples = [sample for samples in quiet for sample in samples]

    print(f"  NOISE_LOUD_DAY_SHARE: {share(len(loud), len(by_date))}")
    print(f"  NOISE_LOUD_DAY_LEVEL: {quantile_table([statistics.fmean(l for l, _ in s) for s in loud], [0, 0.1, 0.25, 0.5, 0.6, 0.75, 0.9, 1])}")
    deviations = [laeq - statistics.fmean(l for l, _ in s) for s in loud for laeq, _ in s]
    print(f"  loud-day LAEQ deviation from the day mean: {min(deviations):.2f} .. {max(deviations):.2f}")
    print(f"  NOISE_QUIET_LAEQ (non-peak): {quantile_table([l for l, _ in quiet_samples if l < PEAK_DB])}")
    offsets = [c - l for l, c in quiet_samples if l < PEAK_DB and c < PEAK_DB]
    print(f"  NOISE_LCPK_OFFSET (LCPK - LAEQ): {quantile_table(offsets, [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99])}")
    print(f"  NOISE_PEAK_SHARE (LCPK peaks, all days): {share(sum(1 for _, c in all_samples if c >= PEAK_DB), len(all_samples))}")
    print(f"  NOISE_PEAK_LAEQ: {quantile_table([l for l, _ in quiet_samples if l >= PEAK_DB], [0, 0.05, 0.1, 0.25, 0.4, 0.45, 1])}")
    peaks = [c for _, c in all_samples if c >= PEAK_DB]
    print(f"  LCPK peaks: {quantile_table(peaks, [0.25, 0.5, 0.9, 0.99, 1])}, share >=129.5: {share(sum(1 for c in peaks if c >= 129.5), len(peaks))}")
    print(f"  LAEQ peaks on loud days: {sum(1 for s in loud for l, _ in s if l >= PEAK_DB)}")
    print("  validation targets:")
    print(f"    daily mean LAEQ: {quantile_table(list(day_means.values()), [0.1, 0.5, 0.9])}, days >=80: {share(sum(1 for m in day_means.values() if m >= 80), len(day_means))}")


def dust(directory):
    print("DUST")
    columns = {"PM1T": "PM 1 TWA", "PM1S": "PM 1 STEL", "PM10T": "PM 10.0 TWA", "PM10S": "PM 10.0 STEL"}
    maxima_columns = ["PM 1 STEL", "PM 2.5 STEL", "PM 4.25 STEL", "PM 10.0 STEL", "PM 1 TWA", "PM 2.5 TWA", "PM 4.25 TWA", "PM 10.0 TWA"]
    times, by_date = [], defaultdict(list)
    with open(f"{directory}/DustData.csv", newline="") as file:
        for row in csv.DictReader(file):
            time = parse_time(row["Timestamp"])
            times.append(time)
            by_date[time.date()].append({**{key: float(row[name]) for key, name in columns.items()}, **{name: float(row[name]) for name in maxima_columns}})
    shift_summary(times)

    dusty = [s for s in by_date.values() if statistics.fmean(x["PM1T"] for x in s) >= DUSTY_DAY_MEAN_PM1_TWA]
    clean = [s for s in by_date.values() if statistics.fmean(x["PM1T"] for x in s) < DUSTY_DAY_MEAN_PM1_TWA]
    print(f"  DUST_DUSTY_DAY_SHARE: {share(len(dusty), len(by_date))}")
    for key in columns:
        print(f"  dusty {key}: {quantile_table([x[key] for s in dusty for x in s], [0, 0.25, 0.5, 0.75, 1])}")
    print(f"  DUST_CLEAN_TWA (PM1): {quantile_table([x['PM1T'] for s in clean for x in s], [0, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1])}")
    print(f"  DUST_CLEAN_STEL (PM1): {quantile_table([x['PM1S'] for s in clean for x in s], [0, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1])}")
    # 99th percentile rather than the maximum, which has a single outlier for PM1 STEL
    clean_maxima = {name: sorted(x[name] for s in clean for x in s)[int(0.99 * (sum(len(s) for s in clean) - 1))] for name in maxima_columns}
    print("  clean-day p99 relative to PM1 (DUST_CLEAN_SIZE_FACTOR): " + ", ".join(
        f"{name}: {clean_maxima[name] / clean_maxima['PM 1 ' + name.split()[-1]]:.2f}" for name in maxima_columns
    ))
    daily = [statistics.fmean(x["PM1T"] for x in s) for s in by_date.values()]
    print(f"  validation targets: daily mean PM1 TWA {quantile_table(daily, [0.1, 0.5, 0.9])}")


def vibration(directory):
    print("VIBRATION")
    connected, points = [], []
    with open(f"{directory}/VibrationData.csv", newline="") as file:
        for row in csv.DictReader(file):
            if row["ConnectedOn"].strip() and row["Tag Exposure Points"].strip():
                connected.append(parse_time(row["ConnectedOn"]))
                points.append(float(row["Tag Exposure Points"]))
    per_day = Counter(time.date() for time in connected)
    by_hour = Counter(time.hour for time in connected)
    print(f"  days: {len(per_day)}, weekdays: {dict(Counter(d.strftime('%a') for d in per_day))}")
    print(f"  VIBRATION_SESSIONS_PER_DAY: {statistics.fmean(per_day.values()):.1f} (sd {statistics.pstdev(per_day.values()):.2f})")
    print(f"  VIBRATION_HOURLY_SHARE (UTC hour): { {hour: round(count / len(connected), 4) for hour, count in sorted(by_hour.items())} }")
    print(f"  VIBRATION_POINTS: {quantile_table(points)}, zero share: {share(sum(1 for p in points if p == 0), len(points))}, mean: {statistics.fmean(points):.3f}")
    ordered = sorted(connected)
    gaps = [(b - a).total_seconds() for a, b in zip(ordered, ordered[1:]) if a.date() == b.date()]
    print(f"  gap between connections (s): {quantile_table(gaps, [0.05, 0.25, 0.5, 0.75, 0.95])}, mean {statistics.fmean(gaps):.0f}")
    daily_sums = defaultdict(float)
    for time, value in zip(connected, points):
        daily_sums[time.date()] += value
    sums = list(daily_sums.values())
    print(f"  validation targets: daily sum {quantile_table(sums, [0.1, 0.5, 0.9])}, days >=100: {share(sum(1 for s in sums if s >= 100), len(sums))}, >=400: {share(sum(1 for s in sums if s >= 400), len(sums))}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    noise(sys.argv[1])
    dust(sys.argv[1])
    vibration(sys.argv[1])
