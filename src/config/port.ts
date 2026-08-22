const rawPort = process.env.PORT ?? '3000';

if (rawPort.trim() === '') {
  throw new Error(`Invalid PORT: ${rawPort}`);
}

const PORT = Number(rawPort);

if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error(`Invalid PORT: ${rawPort}`);
}

export { PORT };
