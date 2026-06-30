# EchoDeck production image. Debian slim (glibc) so better-sqlite3 uses its
# prebuilt binary without needing a compiler in the image.
FROM node:22-slim

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# App source.
COPY server ./server
COPY public ./public

# Persist data + uploads on a mounted volume in production.
ENV NODE_ENV=production
ENV ECHODECK_DATA=/data/db.json
ENV ECHODECK_UPLOADS=/data/uploads
VOLUME ["/data"]

EXPOSE 3000
CMD ["node", "server/index.js"]
