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

# Apply migrations at startup, then launch API
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
