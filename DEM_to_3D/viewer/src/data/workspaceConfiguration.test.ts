import { describe, expect, it } from 'vitest';
import { defaultManifestUrl, validateWorkspaceConfiguration } from './workspaceConfiguration';

describe('workspace configuration', () => {
  it('keeps older launchers compatible and accepts an explicitly selected dataset', () => {
    expect(validateWorkspaceConfiguration({ dataSource: 'api' })).toEqual({ dataSource: 'api', offline: false, manifestUrl: defaultManifestUrl });
    expect(validateWorkspaceConfiguration({ dataSource: 'prepared', offline: true, manifestUrl: '/scenarios/alternate/v1/manifest.json' }).manifestUrl)
      .toBe('/scenarios/alternate/v1/manifest.json');
  });
  it.each(['https://outside.test/manifest.json', '//outside.test/manifest.json', '/scenarios/../manifest.json',
    '/scenarios/a//manifest.json', '/scenarios/a/manifest.json?q=1', '/scenarios/%2e%2e/manifest.json', ''])('rejects an invalid manifest location %s', manifestUrl => {
    expect(() => validateWorkspaceConfiguration({ dataSource: 'prepared', manifestUrl })).toThrow('manifest URL');
  });
  it('rejects ambiguous modes and coerced offline values', () => {
    expect(() => validateWorkspaceConfiguration({ dataSource: 'other' })).toThrow('configuration');
    expect(() => validateWorkspaceConfiguration({ dataSource: 'api', offline: 'true' })).toThrow('offline');
  });
});
