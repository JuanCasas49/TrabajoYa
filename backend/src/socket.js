import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { memberOf } from './routes/chat.js';

export function setupSocket(httpServer, origins) {
  const io = new Server(httpServer, { cors: { origin: origins || true } });
  io.use((socket, next) => {
    try {
      socket.user = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });
  io.on('connection', (socket) => {
    socket.on('join', async (convId, ack) => {
      try {
        if (await memberOf(convId, socket.user.id)) { socket.join(`conv:${convId}`); ack?.(true); }
        else ack?.(false);
      } catch { ack?.(false); }
    });
  });
  return io;
}
