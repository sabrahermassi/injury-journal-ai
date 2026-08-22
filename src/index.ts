import app from './app.js';

const rawPort = process.env.PORT ?? '3000';
const PORT = Number(rawPort);

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${rawPort}`);
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
