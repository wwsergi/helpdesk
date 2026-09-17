# Base Image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency files and install
COPY package*.json ./
RUN npm ci

# Copy the entire project
COPY . .

# Build the Next.js production build
RUN npm run build

# Expose port 3000 (Next.js default)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
