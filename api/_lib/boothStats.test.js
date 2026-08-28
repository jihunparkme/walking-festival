import { describe, expect, it } from "vitest";
import { mapBoothsWithStats, toCountMap } from "./boothStats.js";
import { signBoothId } from "./qrSign.js";

const SECRET = "test-secret";

describe("toCountMap", () => {
  it("converts RPC(get_booth_stamp_counts) rows into a { booth_id: count } map", () => {
    const rows = [
      { booth_id: "a", participant_count: 3 },
      { booth_id: "b", participant_count: 10 },
    ];
    expect(toCountMap(rows)).toEqual({ a: 3, b: 10 });
  });

  it("coerces participant_count to Number (Postgres BIGINT often arrives as a string)", () => {
    const rows = [{ booth_id: "a", participant_count: "42" }];
    const result = toCountMap(rows);
    expect(result.a).toBe(42);
    expect(typeof result.a).toBe("number");
  });

  it("returns an empty map for null/undefined input (RPC returned no rows)", () => {
    expect(toCountMap(null)).toEqual({});
    expect(toCountMap(undefined)).toEqual({});
  });

  it("returns an empty map for an empty array", () => {
    expect(toCountMap([])).toEqual({});
  });
});

describe("mapBoothsWithStats", () => {
  it("attaches participant_count from the countMap and a valid qr_sig per booth", () => {
    const booths = [
      { id: 1, booth_id: "a", title: "부스 A" },
      { id: 2, booth_id: "b", title: "부스 B" },
    ];
    const countMap = { a: 5 };

    const result = mapBoothsWithStats(booths, countMap, SECRET);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ booth_id: "a", participant_count: 5 });
    expect(result[0].qr_sig).toBe(signBoothId("a", SECRET));
  });

  it("defaults participant_count to 0 when the booth is missing from the countMap", () => {
    const booths = [{ id: 1, booth_id: "no-stamps", title: "부스" }];
    const result = mapBoothsWithStats(booths, {}, SECRET);
    expect(result[0].participant_count).toBe(0);
  });

  it("returns an empty array when there are no booths", () => {
    expect(mapBoothsWithStats([], {}, SECRET)).toEqual([]);
  });
});
