FROM node:22-alpine

WORKDIR /app

# Install dependencies using layer caching
COPY package*.json ./
RUN npm ci

# Copy frontend source files
COPY . .

EXPOSE 5173

# Run Vite bound to 0.0.0.0 so Docker port forwarding works cleanly
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]