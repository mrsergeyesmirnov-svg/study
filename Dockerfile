FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY . .

# API URL для фронта (Railway: задай VITE_API_URL в Variables web-сервиса)
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -w @vtgshmot/api && npm run build -w @vtgshmot/web

RUN chmod +x docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./docker-entrypoint.sh"]
