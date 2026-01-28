FROM node:18-slim AS builder

RUN apt-get update && apt-get install -y \
  build-essential \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-slim

RUN apt-get update && apt-get install -y \
  libcairo2 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libjpeg62-turbo \
  libgif7 \
  librsvg2-2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
COPY src/assets ./src/assets

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000
CMD ["node", "dist/index.js"]
