# Single-container deploy: Node/Express serves both the API and the
# static frontend (server.js already does app.use(express.static(...))).
FROM node:20-slim

WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

COPY backend ./backend
COPY frontend ./frontend
RUN mkdir -p /app/data

WORKDIR /app/backend
ENV PORT=4000
EXPOSE 4000

CMD ["node", "server.js"]
