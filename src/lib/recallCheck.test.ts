import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isAllowedRecallUrl,
  fetchCpscRecallsForProduct,
  fetchFdaRecallsForProduct,
} from "./recallCheck";

describe("isAllowedRecallUrl", () => {
  it("allows an official cpsc.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.cpsc.gov/Recalls/2024/example")).toBe(true);
  });

  it("allows an official saferproducts.gov URL", () => {
    expect(
      isAllowedRecallUrl("https://www.saferproducts.gov/RestWebServices/Recall?RecallID=1"),
    ).toBe(true);
  });

  it("allows an official fda.gov URL", () => {
    expect(
      isAllowedRecallUrl(
        "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts/example",
      ),
    ).toBe(true);
  });

  it("allows an official nhtsa.gov URL", () => {
    expect(isAllowedRecallUrl("https://www.nhtsa.gov/recalls?nhtsaId=12345")).toBe(true);
  });

  it("allows a bare (no subdomain) allowed host", () => {
    expect(isAllowedRecallUrl("https://cpsc.gov/Recalls")).toBe(true);
  });

  it("rejects a non-https URL on an otherwise allowed host", () => {
    expect(isAllowedRecallUrl("http://www.cpsc.gov/Recalls/2024/example")).toBe(false);
  });

  it("rejects a lookalike domain with the allowed host as a suffix of a longer label (cpsc.gov.evil.com)", () => {
    expect(isAllowedRecallUrl("https://cpsc.gov.evil.com/Recalls")).toBe(false);
  });

  it("rejects a lookalike domain that merely contains the allowed host as a substring (evilcpsc.gov)", () => {
    expect(isAllowedRecallUrl("https://evilcpsc.gov/Recalls")).toBe(false);
  });

  it("rejects an unrelated domain entirely", () => {
    expect(isAllowedRecallUrl("https://example.com/not-a-recall")).toBe(false);
  });

  it("rejects a malformed URL instead of throwing", () => {
    expect(() => isAllowedRecallUrl("not a url")).not.toThrow();
    expect(isAllowedRecallUrl("not a url")).toBe(false);
  });

  it("rejects an empty string instead of throwing", () => {
    expect(() => isAllowedRecallUrl("")).not.toThrow();
    expect(isAllowedRecallUrl("")).toBe(false);
  });
});

// Regression coverage for the reported "registry check search is very
// slow" bug: fetchCpscRecallsForProduct/fetchFdaRecallsForProduct had no
// timeout on their external fetch() calls, unlike every other fetch
// helper in this codebase, so a hung saferproducts.gov/api.fda.gov
// response left the search spinning indefinitely instead of failing fast.
function abortableFetchMock() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted", "AbortError"));
      });
    });
  });
}

describe("fetchCpscRecallsForProduct — timeout resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("regression: resolves to [] once the timeout fires, rather than hanging forever, when the API never responds", async () => {
    vi.useFakeTimers();
    const fetchMock = abortableFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchCpscRecallsForProduct("stroller");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // The abort signal must actually have been wired through to fetch().
    const passedInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(passedInit?.signal).toBeInstanceOf(AbortSignal);
  });

  it("still returns matching recalls quickly when the API responds normally (no regression from adding the timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => [
          {
            RecallID: "123",
            RecallHeading: "Test Stroller Recall",
            Products: [{ Name: "Test Stroller" }],
            Hazards: [{ Name: "Fall hazard" }],
            URL: "https://www.saferproducts.gov/x",
            RecallDate: "2026-01-01",
          },
        ],
      })),
    );

    const result = await fetchCpscRecallsForProduct("Test Stroller");

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Stroller Recall");
  });
});

describe("fetchFdaRecallsForProduct — timeout resilience", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("regression: resolves to [] once the timeout fires, rather than hanging forever, when the API never responds", async () => {
    vi.useFakeTimers();
    const fetchMock = abortableFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchFdaRecallsForProduct("infant formula");
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await promise;

    expect(result).toEqual([]);
    // Both of the two parallel FDA requests should have been attempted.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("still returns matching recalls quickly when the API responds normally (no regression from adding the timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          results: [
            {
              recall_number: "F-001",
              product_description: "Test Infant Formula",
              reason_for_recall: "Possible contamination",
              recall_initiation_date: "2026-01-01",
            },
          ],
        }),
      })),
    );

    const result = await fetchFdaRecallsForProduct("Test Infant Formula");

    expect(result).toHaveLength(1);
    expect(result[0].productDescription).toBe("Test Infant Formula");
  });
});
