import mongoose from 'mongoose';
import { env } from '../config/env';

export async function connectDatabase(uri: string = env.mongodbUri): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  if (!uri) {
    throw new Error('[Database] MONGODB_URI is not defined in backend/.env');
  }

  // Mask credentials for clean logging
  const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
  console.info(`[Database] Connecting to MongoDB at ${maskedUri}...`);

  const connection = await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  console.info('[Database] MongoDB connected successfully.');
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
