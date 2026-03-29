import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { handleAuthError } from './middleware/auth';
import { errorHandler } from './middleware/errorHandler';
import router from './routes/index';

const app = express();
const PORT = process.env.PORT ?? 3000;

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? '*',
    credentials: true,
  }),
);
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/v1', router);

// Error handling (order matters — must be last)
app.use(handleAuthError);
app.use(errorHandler);

app.listen(PORT, () => {
  if (process.env.NODE_ENV === 'development') {
    process.stdout.write(`[server] Running on http://localhost:${PORT}\n`);
  }
});

export default app;
