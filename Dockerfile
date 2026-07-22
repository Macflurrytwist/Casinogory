# Build context is the discord-bot/ folder itself (see render.yaml's
# dockerContext). This process holds a persistent WebSocket connection
# to Discord — it needs no open port, just outbound network, so it
# deploys as a "worker" (no public URL) rather than a web service.
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Re-registering commands on every boot is safe (it's just an overwrite),
# so this keeps command definitions in sync with the code with zero
# manual steps once env vars are set on the host.
CMD ["sh", "-c", "node deploy-commands.js && node index.js"]
