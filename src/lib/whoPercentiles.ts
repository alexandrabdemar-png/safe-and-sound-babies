// WHO Child Growth Standards — approximate combined (sex-averaged) percentile tables
// Source: WHO Multicentre Growth Reference Study Group (2006)
// Values are approximations suitable for general reference display.
// Always advise parents to discuss growth with their pediatrician.

// Each row: [p5, p25, p50, p75, p95] for months 0–24
// Weight in lbs
const WEIGHT_PCT: [number, number, number, number, number][] = [
  [5.5, 6.6, 7.4, 8.2, 9.1],   // 0
  [7.5, 9.0, 10.1, 11.3, 12.5], // 1
  [9.5, 11.2, 12.5, 14.0, 15.5],// 2
  [11.0, 12.8, 14.3, 16.1, 17.8],// 3
  [12.1, 14.1, 15.7, 17.7, 19.7],// 4
  [13.0, 15.1, 16.8, 18.9, 21.0],// 5
  [13.8, 16.0, 17.9, 20.1, 22.4],// 6
  [14.5, 16.8, 18.7, 21.1, 23.5],// 7
  [15.1, 17.5, 19.6, 22.1, 24.7],// 8
  [15.6, 18.1, 20.3, 22.9, 25.6],// 9
  [16.1, 18.7, 21.0, 23.7, 26.6],// 10
  [16.6, 19.3, 21.7, 24.4, 27.3],// 11
  [17.1, 19.8, 22.3, 25.2, 28.2],// 12
  [17.5, 20.3, 22.9, 25.8, 29.0],// 13
  [17.9, 20.8, 23.4, 26.5, 29.7],// 14
  [18.3, 21.3, 24.0, 27.1, 30.4],// 15
  [18.7, 21.7, 24.5, 27.8, 31.1],// 16
  [19.0, 22.2, 25.1, 28.4, 31.8],// 17
  [19.4, 22.7, 25.6, 29.1, 32.7],// 18
  [19.8, 23.1, 26.2, 29.7, 33.4],// 19
  [20.2, 23.6, 26.7, 30.4, 34.1],// 20
  [20.6, 24.0, 27.3, 31.0, 34.8],// 21
  [21.0, 24.5, 27.8, 31.7, 35.5],// 22
  [21.4, 25.0, 28.4, 32.4, 36.4],// 23
  [21.8, 25.5, 29.0, 33.1, 37.3],// 24
];

// Height in inches
const HEIGHT_PCT: [number, number, number, number, number][] = [
  [18.1, 18.9, 19.7, 20.4, 21.2], // 0
  [20.2, 21.0, 21.8, 22.6, 23.5], // 1
  [21.8, 22.7, 23.6, 24.5, 25.4], // 2
  [23.1, 24.1, 25.0, 26.0, 27.0], // 3
  [24.2, 25.2, 26.2, 27.2, 28.2], // 4
  [25.0, 26.1, 27.1, 28.1, 29.2], // 5
  [25.7, 26.9, 27.9, 29.0, 30.1], // 6
  [26.4, 27.6, 28.7, 29.8, 30.9], // 7
  [27.0, 28.2, 29.4, 30.5, 31.7], // 8
  [27.5, 28.8, 30.0, 31.2, 32.5], // 9
  [28.0, 29.3, 30.5, 31.8, 33.1], // 10
  [28.5, 29.8, 31.1, 32.4, 33.7], // 11
  [28.9, 30.3, 31.6, 33.0, 34.3], // 12
  [29.3, 30.7, 32.1, 33.4, 34.8], // 13
  [29.7, 31.1, 32.5, 33.9, 35.3], // 14
  [30.1, 31.5, 32.9, 34.3, 35.8], // 15
  [30.4, 31.9, 33.3, 34.8, 36.2], // 16
  [30.7, 32.2, 33.7, 35.2, 36.7], // 17
  [31.0, 32.6, 34.1, 35.6, 37.1], // 18
  [31.4, 32.9, 34.5, 36.0, 37.5], // 19
  [31.7, 33.2, 34.8, 36.3, 37.9], // 20
  [31.9, 33.5, 35.1, 36.7, 38.3], // 21
  [32.2, 33.8, 35.4, 37.1, 38.7], // 22
  [32.5, 34.1, 35.8, 37.4, 39.0], // 23
  [32.8, 34.5, 36.1, 37.8, 39.4], // 24
];

const BREAKPOINTS = [5, 25, 50, 75, 95] as const;

function lookupPercentile(value: number, table: [number, number, number, number, number]): number {
  if (value <= table[0]) return Math.max(1, Math.round(5 * (value / table[0])));
  if (value >= table[4]) return Math.min(99, Math.round(95 + 4 * ((value - table[4]) / table[4])));
  for (let i = 0; i < 4; i++) {
    if (value >= table[i] && value <= table[i + 1]) {
      const frac = (value - table[i]) / (table[i + 1] - table[i]);
      return Math.round(BREAKPOINTS[i] + frac * (BREAKPOINTS[i + 1] - BREAKPOINTS[i]));
    }
  }
  return 50;
}

function clampMonth(m: number) {
  return Math.max(0, Math.min(24, Math.round(m)));
}

export function weightPercentile(weightLbs: number, ageMonths: number): number {
  return lookupPercentile(weightLbs, WEIGHT_PCT[clampMonth(ageMonths)]);
}

export function heightPercentile(heightInches: number, ageMonths: number): number {
  return lookupPercentile(heightInches, HEIGHT_PCT[clampMonth(ageMonths)]);
}

export function ordinal(n: number): string {
  if (n >= 11 && n <= 13) return `${n}th`;
  const s = ["th", "st", "nd", "rd"];
  return `${n}${s[n % 10] ?? "th"}`;
}
