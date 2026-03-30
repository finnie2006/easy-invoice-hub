FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy source code
COPY src/ src/

# Prepare writable upload directory and drop root privileges
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "start"]
