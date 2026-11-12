import { env } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../database/connect';
import { ensureBaselineSeed } from './bootstrap';

async function run() {
  await connectDatabase(env.mongodbUri);
  await ensureBaselineSeed();
  console.info('[Seed] Baseline Admin, settings, categories, and plans verified.');
  await disconnectDatabase();
}

run().catch((err) => {
  console.error('[Seed] Failed:', err);
  process.exit(1);
});
