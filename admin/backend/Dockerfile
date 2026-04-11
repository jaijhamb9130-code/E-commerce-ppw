FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
# Install only production dependencies to save space and time
RUN npm ci --only=production

COPY dist ./dist
COPY .env ./

CMD ["node", "dist/src/main.js"]
