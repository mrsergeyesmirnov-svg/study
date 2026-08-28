FROM node:22-alpine AS build

WORKDIR /app

# Workspace manifests first (better layer cache)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY . .

RUN npm run build -w @vtgshmot/api

EXPOSE 3001

CMD ["npm", "run", "start:railway", "-w", "@vtgshmot/api"]
