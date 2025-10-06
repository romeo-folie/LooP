## Express Server

### Setup

**1. Setup postgres DB locally**

**2. Generate web push vapid keys**
```
npm install -g web-push
npx web-push generate-vapid-keys
```

**3. touch .env and set environment variables**
```
 PORT=5999
 DB_HOST=db
 DB_PORT=5432
 DB_USER=postgres
 DB_PASSWORD=
 DB_NAME=loop-db
 NODE_ENV=development
 JWT_SECRET=
 REFRESH_SECRET=
 RESET_PASSWORD_SECRET=
 GITHUB_CLIENT_ID=
 GITHUB_CLIENT_SECRET=
 CLIENT_URL=http://localhost:5173
 SERVER_URL=http://localhost:5999
 RESEND_API_KEY=
 RESEND_FROM_EMAIL=
 VAPID_PUBLIC_KEY=
 VAPID_PRIVATE_KEY=
 CONTACT_EMAIL=
 CSRF_SECRET_KEY=
 DOMAIN=localhost
 REDIS_URL=redis://localhost:6379
```

**4. Install dependencies and run**
```
npm install
npm run dev
```

### Alternative setup with Docker

**1. Add environment variables to the following docker-compose template**
```
version: '3.9'

services:
  redis:
    image: redis:7-alpine
    container_name: loop-redis-container
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 2s
      retries: 5

  server:
    build: .
    container_name: loop-server-container
    ports:
      - "5999:5999"
    environment:
      - PORT=5999
      - DB_HOST=db
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASSWORD=
      - DB_NAME=loop-db
      - NODE_ENV=development
      - JWT_SECRET=
      - REFRESH_SECRET=
      - RESET_PASSWORD_SECRET=
      - GITHUB_CLIENT_ID=
      - GITHUB_CLIENT_SECRET=
      - CLIENT_URL=
      - SERVER_URL=
      - RESEND_API_KEY=
      - RESEND_FROM_EMAIL=
      - VAPID_PUBLIC_KEY=
      - VAPID_PRIVATE_KEY=
      - CONTACT_EMAIL=
      - CSRF_SECRET_KEY=
      - DOMAIN=localhost
      - REDIS_URL=redis://127.0.0.1:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    container_name: loop-db-container
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=
      - POSTGRES_DB=loop-db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
  redis_data:
```

**2. Build the images and start the containers**
```
docker-compose up --build
```

