FROM node:20-alpine

WORKDIR /app

# Package files kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm install

# Source code kopieren
COPY . .

# Port exponieren
EXPOSE 3000

# Webpack dev server starten
CMD ["npm", "run", "dev"]
