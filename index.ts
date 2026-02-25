import { createApp } from './src/app';
import { env } from './src/config/env';

const app = createApp();

app.listen(env.port, () => {
  console.info(`[Server] AI Code Review Bot running on http://localhost:${env.port}`);
  console.info(`[Server] Environment : ${env.nodeEnv}`);
  console.info(`[Server] Health check: GET /health`);
});
