FROM node:22-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Generate Prisma client for runtime
RUN npx prisma generate

EXPOSE 5000

# Apply migrations with the direct database URL when available, then launch API
CMD ["sh", "-c", "set -e; MIGRATION_DATABASE_URL=${DIRECT_DATABASE_URL:-$DATABASE_URL}; DATABASE_URL=\"$MIGRATION_DATABASE_URL\" npx prisma migrate deploy; exec node src/index.js"]
