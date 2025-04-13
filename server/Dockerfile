# 1. Build Stage
FROM node:20-alpine AS build

# Set the working directory
WORKDIR /app

# Copy package and lock files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Build TS code -> /app/dist
RUN npm run build

# 2. Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy only the build output from the first stage
COPY --from=build /app/dist ./dist

# Copy package.json again
COPY package*.json ./

# Install only production dependencies (no dev deps)
RUN npm install --omit=dev

# Expose server port
EXPOSE 5999

# Run compiled server
CMD ["node", "dist/src/index.js"]
