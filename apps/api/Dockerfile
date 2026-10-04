FROM node:24-alpine AS build

RUN apk add --no-cache git
WORKDIR /app
ENV NX_DAEMON=false

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx nx build api --configuration=production

FROM node:24-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=build /app/dist/apps/api/package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist/apps/api/main.js ./
RUN chown -R app:app /app

USER app
EXPOSE 3000
CMD ["node", "main.js"]
