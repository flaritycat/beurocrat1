FROM node:20-alpine AS deps
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY backend ./backend
COPY database ./database
WORKDIR /app/backend
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package*.json ./backend/
COPY database ./database

WORKDIR /app/backend
EXPOSE 3000
CMD ["sh", "-c", "npm run migrate && if [ \"${SEED_DEMO_DATA:-false}\" = \"true\" ]; then npm run seed; fi && npm run start"]
