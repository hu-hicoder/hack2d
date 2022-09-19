FROM node:16-alpine AS builder

RUN apk add --no-cache libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED 1
COPY . .

RUN yarn install --frozen-lockfile
RUN yarn build

FROM node:16-alpine AS runner

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
WORKDIR /app

COPY --from=builder /app/next.config.js next.config.js
COPY --from=builder /app/.next .next
# COPY --from=builder /app/.env .env
COPY --from=builder /app/public public
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/yarn.lock yarn.lock

CMD ["yarn", "start"] # npmなら, npm run start
