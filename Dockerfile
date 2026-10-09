# Creator OS: the Node web app and the Python agents service in one image.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY agents ./agents
COPY public ./public
COPY scripts ./scripts
COPY fixtures ./fixtures
COPY openapi.yaml ./

RUN mkdir -p data && chown node:node data
USER node

ENV NODE_ENV=production HOST=0.0.0.0 PORT=4173
EXPOSE 4173
CMD ["node", "--no-warnings", "src/main.ts"]
