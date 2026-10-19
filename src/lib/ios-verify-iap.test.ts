import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = resolve('scripts/ios-verify-iap.mjs');
function runFixture(registered: boolean, linked: boolean) {
  const root = mkdtempSync(join(tmpdir(), 'iap-preflight-'));
  const write = (path: string, value: string) => {
    const destination = join(root, path);
    mkdirSync(resolve(destination, '..'), { recursive: true });
    writeFileSync(destination, value);
  };
  try {
    write('ios/App/App/capacitor.config.json', JSON.stringify({ appId: 'com.peaceofmine.baby', packageClassList: registered ? ['AppleIAPPlugin'] : [] }));
    write('ios/App/CapApp-SPM/Package.swift', linked ? '.product(name: "AppleIap", package: "AppleIap")' : 'OtherPlugin');
    write('node_modules/apple-iap/ios/Sources/AppleIAPPlugin/AppleIAPPlugin.swift', 'let monthly = "monthlyplan"; let annual = "annualplan"');
    return spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
describe('native Apple purchase preflight', () => {
  it('blocks an unregistered plugin', () => {
    const result = runFixture(false, true);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('not registered');
  });
  it('blocks a missing native dependency', () => {
    const result = runFixture(true, false);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing');
  });
  it('accepts registered and linked current products', () => {
    expect(runFixture(true, true).status).toBe(0);
  });
});