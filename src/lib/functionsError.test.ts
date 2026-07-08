import { describe, it, expect } from "vitest";
import { extractFunctionsErrorMessage } from "./functionsError";

function fakeContext(body: unknown): Response {
  return {
    json: async () => body,
    clone() {
      return this;
    },
  } as unknown as Response;
}

// A real FunctionsHttpError is an Error subclass with a `context` property
// (the raw Response) — matching that shape here (rather than a plain
// object) so these tests exercise the real `err instanceof Error` branch.
function fakeFunctionsHttpError(message: string, context: Response): Error {
  return Object.assign(new Error(message), { context });
}

describe("extractFunctionsErrorMessage", () => {
  it("extracts the specific {error} message from the FunctionsHttpError context body", async () => {
    const err = fakeFunctionsHttpError(
      "Edge Function returned a non-2xx status code",
      fakeContext({ error: "You can't invite yourself" }),
    );
    const msg = await extractFunctionsErrorMessage(err, "fallback");
    expect(msg).toBe("You can't invite yourself");
  });

  it("falls back to err.message when context.json() rejects (non-JSON body)", async () => {
    const err = fakeFunctionsHttpError("Edge Function returned a non-2xx status code", {
      json: async () => { throw new Error("not json"); },
      clone() { return this; },
    } as unknown as Response);
    const msg = await extractFunctionsErrorMessage(err, "fallback");
    expect(msg).toBe("Edge Function returned a non-2xx status code");
  });

  it("falls back to err.message when there is no context at all (network error)", async () => {
    const err = new Error("Failed to fetch");
    const msg = await extractFunctionsErrorMessage(err, "fallback");
    expect(msg).toBe("Failed to fetch");
  });

  it("falls back to the fallback string when err is not an Error and has no context", async () => {
    const msg = await extractFunctionsErrorMessage("some string", "fallback");
    expect(msg).toBe("fallback");
  });

  it("falls back to err.message when the context body has no string 'error' field", async () => {
    const err = fakeFunctionsHttpError("generic", fakeContext({ notError: true }));
    const msg = await extractFunctionsErrorMessage(err, "fallback");
    expect(msg).toBe("generic");
  });
});
