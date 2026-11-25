
FROM node:22-alpine

WORKDIR /app

COPY backend/package*.json ./

RUN npm install --omit=dev

COPY backend/ .

RUN mkdir -p uploads && chown -R node:node uploads

USER node

EXPOSE 4000

CMD ["sh", "-c", "npm run migrate && node src/server.js"]
