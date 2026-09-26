# --- Base Stage ---
# Use an official Node.js runtime as a parent image.
# '18-alpine' is a good choice: it's a recent LTS version and 'alpine' is a very small, secure Linux distribution.
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
EXPOSE 5001
CMD [ "node", "dist/server.js" ]