FROM node:20-alpine

WORKDIR /app

# Package files kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm install

# Source code kopieren
COPY . .

# TypeScript kompilieren
RUN npm run build

# Port exponieren
EXPOSE 5000

# Server starten
CMD ["npm", "start"]
