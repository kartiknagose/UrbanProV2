FROM node:20-bookworm-slim

WORKDIR /app

# Prisma query engine needs OpenSSL runtime libraries in production.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

# Install deps first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# Generate Prisma client for runtime
RUN npx prisma generate

EXPOSE 5000

# Launch API directly on Render; migrations should run as a controlled release step.
CMD ["sh", "-c", "exec node src/index.js"]
