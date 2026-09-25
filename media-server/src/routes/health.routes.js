// Liveness endpoints. The Docker/compose healthcheck pings `/`; `/healthz`
// is the machine-readable status probe.
import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => res.send(`🖼️ Optimized Media Server (Worker ${process.pid}) Running`));

router.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

export default router;