import path from 'node:path';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env.test');

const result = dotenv.config({
  path: envPath,
  override: true,
});

if (result.error) {
  throw new Error(`Failed to load ${envPath}: ${result.error.message}`);
}

if (!process.env.DATABASE_URL?.includes('testing_injury_ai')) {
  throw new Error('Integration tests must use the testing_injury_ai database');
}
