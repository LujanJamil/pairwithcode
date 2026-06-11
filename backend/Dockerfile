FROM node:18-alpine

WORKDIR /app

# Install build tools for native dependencies
RUN apk add --no-cache python3 make g++ ffmpeg

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm ci --only=development

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
