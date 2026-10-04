FROM node:24-alpine AS build

RUN apk add --no-cache git
WORKDIR /app
ENV NX_DAEMON=false

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG BUILD_CONFIGURATION=production
RUN npx nx build admin --configuration=${BUILD_CONFIGURATION}

FROM nginx:1.27-alpine

RUN apk add --no-cache wget
COPY docker/nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/apps/admin/browser /usr/share/nginx/html
EXPOSE 80
