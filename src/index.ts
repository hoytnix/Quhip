import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types';
import { ingestRouter } from './routes/ingest';
import { authRouter } from './routes/auth';
import { dashboardRouter } from './routes/dashboard';
import { scriptRouter } from './routes/script';
import { renderDashboardHtml } from './ui/dashboard';

const app = new Hono<{ Bindings: Env }>();

// Global CORS configuration
app.use('/api/*', cors({
  origin: (origin) => origin || '*',
  allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));

app.use('/quhip.js', cors({
  origin: '*',
  allowMethods: ['GET', 'OPTIONS']
}));

// Health check
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', name: 'Quhip', version: '1.0.0' });
});

// Mount Routes
app.route('/', scriptRouter);
app.route('/', ingestRouter);
app.route('/', authRouter);
app.route('/', dashboardRouter);

// Serve Dashboard HTML at root and /dashboard
app.get('/', (c) => {
  return c.html(renderDashboardHtml());
});

app.get('/dashboard', (c) => {
  return c.html(renderDashboardHtml());
});

export default app;
