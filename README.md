# UniGuard Wallet

## Project info

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

## Project Structure

```
├── frontend/          # React/TypeScript frontend application
│   ├── src/          # Source code
│   ├── public/       # Static assets
│   └── package.json  # Frontend dependencies
├── backend/          # Backend services and infrastructure
│   ├── training/     # Python ML model training
│   ├── server/       # Node.js notification server
│   └── supabase/     # Database migrations
└── README.md         # This file
```

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Navigate to frontend and install dependencies
cd frontend

# Step 3: Navigate to frontend and install dependencies
cd frontend
npm install

# Step 4: Start the development server
npm run dev
```

For backend services:

```sh
# Training ML models (requires Python)
cd backend/training
python train_models.py --model all

# Notification server (from frontend directory)
cd frontend
npm run notify:server
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

**Deploying to Railway (or other hosts):**  
Add these **build-time** environment variables so the app can connect to Supabase:

- `VITE_SUPABASE_URL` — your Supabase project URL (e.g. `https://xxxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` — your Supabase anon/public key

In Railway: Project → Variables → Add Variable. Then redeploy. Without these, the app still loads but login and Supabase features will be disabled.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
# version2-smart-app
