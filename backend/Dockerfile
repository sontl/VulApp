FROM node:22

WORKDIR /app

# Non-slim image has build tools, but we'll make sure
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install
RUN npm rebuild sqlite3 --build-from-source

COPY . .

# Ensure upload directory exists
RUN mkdir -p uploads

EXPOSE 5001

CMD ["npm", "run", "dev"]
