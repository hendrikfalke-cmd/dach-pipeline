# DACH Pipeline

Private credit origination tracker for the DACH market. Tracks active deals, expected deals, sponsors, advisors, and meeting notes — with AI-powered parsing of pipeline screenshots and handwritten notes.

## Deploy your own instance

Each person gets their own database and login — data is fully separate.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/hendrikfalke-cmd/dach-pipeline&env=DATABASE_URL,APP_PASSWORD,ANTHROPIC_API_KEY,PIPELINE_API_KEY&envDescription=See%20README%20for%20setup%20instructions&project-name=dach-pipeline&repository-name=dach-pipeline)

### Step 1 — Create your database (Neon)

1. Sign up at [neon.tech](https://neon.tech) → create a new project
2. Go to **SQL Editor** → paste the contents of [`schema.sql`](./schema.sql) → run it
3. Copy your **connection string** from Dashboard → Connection Details

### Step 2 — Deploy to Vercel

Click the button above. When prompted for environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Your Neon connection string (`postgresql://...`) |
| `APP_PASSWORD` | Password to log into the app — choose anything |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) — needed for AI parsing |
| `PIPELINE_API_KEY` | Optional — protects the `/api/pipeline-summary` export endpoint |

### Step 3 — Done

Your app is live at `https://your-project.vercel.app`. Log in with the `APP_PASSWORD` you set.

---

## Run locally

```bash
git clone https://github.com/hendrikfalke-cmd/dach-pipeline
cd dach-pipeline
npm install
```

Create `.env.local`:
```
DATABASE_URL=postgresql://your-neon-connection-string
APP_PASSWORD=yourpassword
ANTHROPIC_API_KEY=sk-ant-...
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Stack

- **Frontend/Backend** — Next.js 16 on Vercel
- **Database** — PostgreSQL via [Neon](https://neon.tech)
- **AI** — Claude (Anthropic) for pipeline screenshot parsing and meeting note extraction
- **Auth** — Single shared password, cookie-based session (90 days)
