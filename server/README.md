# Node Express Server

## Generate Web Push Vapid Keys

```
npm install -g web-push

npx web-push generate-vapid-keys
```

## Docker Compose

```
services:
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
    depends_on:
      - db

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
```

## Setup

```
npm install

npm run dev
```