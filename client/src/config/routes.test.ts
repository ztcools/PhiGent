import { describe, expect, it } from 'vitest';
import { routes, ROUTE_PATHS } from './routes';

describe('routes', () => {
  it('does not expose removed Playground route', () => {
    expect('PLAY' in ROUTE_PATHS).toBe(false);
    expect(routes.some(route => route.path === 'play')).toBe(false);
  });

  it('does not include the legacy connect placeholder route', () => {
    expect('CONNECT' in ROUTE_PATHS).toBe(false);
    expect(routes.some(route => route.path === 'connect')).toBe(false);
  });
});
