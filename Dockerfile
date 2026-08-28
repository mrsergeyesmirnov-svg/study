FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

RUN npm ci

COPY . .

# Railway автоматически подставляет имя сервиса: "web" или "study"
ARG RAILWAY_SERVICE_NAME=api
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL

RUN if [ "$RAILWAY_SERVICE_NAME" = "web" ]; then \
      echo "Building WEB only" && npm run build -w @vtgshmot/web; \
    else \
      echo "Building API only" && npm run build -w @vtgshmot/api; \
    fi

FROM node:22-alpine

WORKDIR /app

RUN npm install -g serve@14

COPY --from=build /app /app

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG RAILWAY_SERVICE_NAME=api
ENV RAILWAY_SERVICE_NAME=$RAILWAY_SERVICE_NAME

EXPOSE 8080

ENTRYPOINT ["/entrypoint.sh"]
