# Dealership CRM — production image.
# Builds the server (tsc) and the client (vite), then runs a single Node process
# that serves both the API and the SPA. See docs/DEPLOY.md for usage.
#
# Build context MUST be the repository root:
#   docker build -t crm .
# Run:
#   docker run -d --name crm -p 3000:3000 --env-file server/.env crm

# ---------- build stage ----------
FROM node:22-alpine AS build
WORKDIR /app

# --- server deps + build ---
COPY server/package*.json server/
RUN cd server && npm ci
COPY server/ server/
RUN cd server && npx prisma generate && npm run build

# --- client deps + build ---
COPY client/package*.json client/
RUN cd client && npm ci
COPY client/ client/
RUN cd client && npm run build

# ---------- runtime stage ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Server runtime: compiled output, node_modules, prisma (schema + migrations), package.json
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/server/node_modules server/node_modules
COPY --from=build /app/server/prisma server/prisma
COPY --from=build /app/server/package.json server/package.json

# Built SPA — the server resolves it at ../../client/dist relative to server/dist
COPY --from=build /app/client/dist client/dist

EXPOSE 3000

# Migrations are intentionally NOT run here (single-instance-safe; run once on
# deploy):  docker run --rm --env-file server/.env crm npx prisma migrate deploy
CMD ["node", "server/dist/index.js"]
