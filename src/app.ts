import express, { type Application } from 'express';
import { reviewRouter } from './routes/review.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Application {
  const app = express();

  // Parse JSON bodies + capture raw body for webhook signature verification
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        // Store the raw body string so verifyWebhookSignature can use it
        (req as express.Request & { rawBody?: string }).rawBody = buf.toString();
      },
    }),
  );

  // Health check — used to verify the server is running
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Feature routes
  app.use('/api/review', reviewRouter);

  // Central error handler — must be registered LAST
  app.use(errorHandler);

  return app;
}
