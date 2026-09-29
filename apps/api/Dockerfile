FROM node:20-alpine
WORKDIR /app
COPY apps/api/package.json ./
RUN npm install
COPY apps/api ./
CMD ["npm", "run", "start:dev"]
