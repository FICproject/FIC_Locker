import { env } from './config/env';
import { connectDatabase } from './database/connect';
import { createApp } from './app';
import { ensureBaselineSeed } from './scripts/bootstrap';

async function main() {
  await connectDatabase(env.mongodbUri);
  await ensureBaselineSeed();

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`[Backend] Shared API server listening on http://localhost:${env.port}${env.apiPrefix}`);
  });
}

main().catch((err) => {
  console.error('[Backend] Fatal startup error:', err);
  process.exit(1);
});

