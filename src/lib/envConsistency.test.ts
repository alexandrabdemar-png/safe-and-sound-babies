import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseEnvFile,
  projectRefFromUrl,
  projectRefFromAnonKey,
  collectProjectRefs,
  MODE_ENV_FILES,
  type EnvFile,
} from "./envConsistency";

const ROOT = resolve(import.meta.dirname, "../..");

function loadEnvFile(name: string): EnvFile | null {
  const path = resolve(ROOT, name);
  if (!existsSync(path)) return null;
  return { name, vars: parseEnvFile(readFileSync(path, "utf8")) };
}

describe("parseEnvFile", () => {
  it("parses quoted, unquoted, and commented lines", () => {
    const vars = parseEnvFile(
      ['# comment', 'A="one"', "B='two'", "C=three", "", "D=has=equals", "junkline"].join("\n"),
    );
    expect(vars).toEqual({ A: "one", B: "two", C: "three", D: "has=equals" });
  });
});

describe("projectRefFromUrl", () => {
  it("extracts the project ref", () => {
    expect(projectRefFromUrl("https://abc123.supabase.co")).toBe("abc123");
    expect(projectRefFromUrl("https://abc123.supabase.co/")).toBe("abc123");
  });
  it("returns null for non-project URLs", () => {
    expect(projectRefFromUrl(undefined)).toBeNull();
    expect(projectRefFromUrl("http://localhost:8080")).toBeNull();
    expect(projectRefFromUrl("https://example.com")).toBeNull();
  });
});

describe("projectRefFromAnonKey", () => {
  it("reads the ref out of a JWT-format anon key", () => {
    const payload = Buffer.from(JSON.stringify({ iss: "supabase", ref: "zzz999" })).toString(
      "base64url",
    );
    expect(projectRefFromAnonKey(`header.${payload}.sig`)).toBe("zzz999");
  });
  it("returns null for opaque or malformed keys", () => {
    expect(projectRefFromAnonKey("sb_publishable_abc")).toBeNull();
    expect(projectRefFromAnonKey("a.b.c")).toBeNull();
    expect(projectRefFromAnonKey(undefined)).toBeNull();
  });
});

describe("collectProjectRefs", () => {
  it("reports one ref when every file agrees", () => {
    const refs = collectProjectRefs([
      { name: ".env", vars: { SUPABASE_URL: "https://aaa.supabase.co", VITE_SUPABASE_PROJECT_ID: "aaa" } },
      { name: ".env.production", vars: { VITE_SUPABASE_URL: "https://aaa.supabase.co" } },
    ]);
    expect([...refs.keys()]).toEqual(["aaa"]);
  });

  it("reproduces the scanner outage: two refs across .env and .env.production", () => {
    const refs = collectProjectRefs([
      { name: ".env", vars: { SUPABASE_URL: "https://aaa.supabase.co" } },
      { name: ".env.production", vars: { VITE_SUPABASE_URL: "https://bbb.supabase.co" } },
    ]);
    expect([...refs.keys()].sort()).toEqual(["aaa", "bbb"]);
    expect(refs.get("bbb")).toEqual([".env.production:VITE_SUPABASE_URL"]);
  });
});

// ── Regression guards against the real repo ────────────────────────────────
describe("repo Supabase env configuration", () => {
  it("has a .env declaring a Supabase project", () => {
    const base = loadEnvFile(".env");
    expect(base, ".env must exist").not.toBeNull();
    expect([...collectProjectRefs([base!]).keys()].length).toBe(1);
  });

  it("does not commit mode-specific env files that could override .env", () => {
    // `.env.development` / `.env.production` outrank `.env` in Vite. The
    // platform manages `.env`, so any committed mode file is a footgun even
    // when its values happen to be correct today.
    const committed = MODE_ENV_FILES.filter((f) => existsSync(resolve(ROOT, f)));
    expect(committed, `remove these files: ${committed.join(", ")}`).toEqual([]);
  });

  it("every env file points at exactly one Supabase project", () => {
    const files = [".env", ...MODE_ENV_FILES]
      .map(loadEnvFile)
      .filter((f): f is EnvFile => f !== null);
    const refs = collectProjectRefs(files);
    expect(
      [...refs.entries()].map(([ref, where]) => `${ref} <- ${where.join(", ")}`),
      "multiple Supabase project refs found; browser and server would talk to different projects",
    ).toHaveLength(1);
  });

  it("the client URL and anon key in .env belong to the same project", () => {
    const base = loadEnvFile(".env")!;
    const urlRef = projectRefFromUrl(base.vars["VITE_SUPABASE_URL"]);
    const keyRef = projectRefFromAnonKey(base.vars["VITE_SUPABASE_PUBLISHABLE_KEY"]);
    expect(urlRef).toBeTruthy();
    if (keyRef) expect(keyRef).toBe(urlRef);
  });
});
