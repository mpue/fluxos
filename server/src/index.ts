import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import prisma from './db';
import userRoutes from './routes/users';
import groupRoutes from './routes/groups';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// HTTP Server
const httpServer = createServer(app);

// WebSocket Server
const wss = new WebSocketServer({ server: httpServer });

// WebSocket Verbindungen
wss.on('connection', (ws) => {
  console.log('Neue WebSocket Verbindung');
  
  ws.on('message', (message) => {
    console.log('Empfangen:', message.toString());
    // Echo zurück
    ws.send(`Server: ${message}`);
  });
  
  ws.on('close', () => {
    console.log('WebSocket Verbindung geschlossen');
  });
});

// REST API Routes
app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Test DB connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'FluxOS Server API' });
});

// User Routes
app.use('/api/users', userRoutes);

// Group Routes
app.use('/api/groups', groupRoutes);

// File Routes
app.get('/api/files', async (req: Request, res: Response) => {
  try {
    const files = await prisma.file.findMany({
      include: {
        owner: {
          select: {
            username: true,
          },
        },
      },
    });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Server starten
httpServer.listen(PORT, async () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`HTTP: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  
  try {
    await prisma.$connect();
    console.log('Datenbank verbunden');
  } catch (error) {
    console.error('Datenbank Verbindungsfehler:', error);
  }
});
