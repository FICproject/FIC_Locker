import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { env } from '../config/env';

let embeddedServer: { stop: () => Promise<boolean> } | null = null;

export async function connectDatabase(uri: string = env.mongodbUri): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  if (env.useLocalEmbeddedDb && env.nodeEnv !== 'production') {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const downloadDir = path.resolve(__dirname, '../../../node_modules/.cache/mongodb-memory-server');
    embeddedServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'doc_scanner_saas',
      },
      binary: {
        downloadDir,
      },
    });
    const localUri = (embeddedServer as unknown as { getUri: () => string }).getUri();
    console.info(`[Database] Using local embedded MongoDB at ${localUri}`);
    return mongoose.connect(localUri);
  }

  return mongoose.connect(uri);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (embeddedServer) {
    await embeddedServer.stop();
    embeddedServer = null;
  }
}
