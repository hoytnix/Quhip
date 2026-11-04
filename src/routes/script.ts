import { Hono } from 'hono';
import { Env } from '../types';
import { SNIPPET_CODE } from '../tracker/generated-snippet';

export const scriptRouter = new Hono<{ Bindings: Env }>();

// Serves tiny tracking snippet (< 10 KB gzipped) (§8)
scriptRouter.get('/quhip.js', (c) => {
  return c.body(SNIPPET_CODE, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*'
  });
});
