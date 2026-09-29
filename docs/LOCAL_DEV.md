# Local development

```bash
cp .env.example .env
docker compose up -d --build
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

Web: http://localhost:3000
API: http://localhost:3001/api/docs

Demo: demo@apexc casino.com / Demo123!
