# Container image so MCP hosts (Glama and others) can start the server and verify it responds to
# introspection over stdio. Read-only and zero-key: no env, no ports, no network at runtime. The price
# data ships inside the ai-price-index dependency, which is installed at build time.
FROM node:22-alpine
WORKDIR /app

# Install production dependencies (the ai-price-index data lib + the MCP SDK) against the lockfile.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The server source (only what the bin needs; tests and docs are not in the image).
COPY bin ./bin
COPY src ./src

# Speaks the Model Context Protocol over stdio.
ENTRYPOINT ["node", "bin/server.js"]
