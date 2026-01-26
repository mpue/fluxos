import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

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
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api', (req: Request, res: Response) => {
  res.json({ message: 'FluxOS Server API' });
});

// Server starten
httpServer.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT}`);
  console.log(`HTTP: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
});
