# PalaceDev — AI Coding Studio
### Built by The Palace, Inc.

A full AI-powered IDE that generates complete codebases from natural language, runs them live, saves everything to Firebase, and works on tasks even when you're away.

---

## 🚀 Quick Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment variables
Open `.env.local` and add your Anthropic API key:
```
ANTHROPIC_API_KEY=your_new_api_key_here
```
The Firebase variables are already filled in for `palacedev-1`.

Also add your app URL for the cron job:
```
NEXT_PUBLIC_APP_URL=https://your-vercel-url.vercel.app
```

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

---

## 🔥 Firebase Setup

Go to [Firebase Console](https://console.firebase.google.com) → palacedev-1 project:

### Firestore Rules (paste in Firestore → Rules):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
> ⚠️ This is open for development. Lock it down before going public.

### Firestore Indexes needed:
Go to Firestore → Indexes → Create composite index:
- Collection: `tasks` | Fields: `status ASC`, `scheduledAt ASC`
- Collection: `tasks` | Fields: `status ASC`, `scheduledAt ASC`, `createdAt ASC`

---

## ☁️ Deploy to Vercel

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial PalaceDev commit"
git remote add origin https://github.com/yourusername/palacedev.git
git push -u origin main
```

### 2. Import to Vercel
- Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub
- Select your repo
- Framework: Next.js (auto-detected)

### 3. Add Environment Variables in Vercel
In Vercel project → Settings → Environment Variables, add:
```
ANTHROPIC_API_KEY        = your_api_key
NEXT_PUBLIC_APP_URL      = https://your-project.vercel.app
NEXT_PUBLIC_FIREBASE_API_KEY = AIzaSyAec7VIWbbSQeLvkocrTA6jNsmh19mh5xM
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN = palacedev-1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID = palacedev-1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = palacedev-1.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID = 496400721606
NEXT_PUBLIC_FIREBASE_APP_ID = 1:496400721606:web:b5285ba8fbf6a0ed21d9c7
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID = G-P4WWXP1N0G
```

### 4. Deploy
Click Deploy. Done! ✅

The Vercel Cron Job (`vercel.json`) will auto-run every 5 minutes to process scheduled tasks.

---

## 📁 Project Structure

```
palacedev/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── editor/page.tsx       # Main AI IDE
│   │   ├── dashboard/page.tsx    # Projects list
│   │   ├── projects/[id]/page.tsx # Individual project
│   │   ├── tasks/page.tsx        # Task queue + automation
│   │   └── api/
│   │       ├── generate/route.ts  # AI generation endpoint
│   │       ├── fix/route.ts       # AI fix endpoint
│   │       ├── process-task/route.ts # Background task processor
│   │       └── cron-check/route.ts   # Vercel cron handler
│   ├── components/
│   │   └── Navbar.tsx
│   └── lib/
│       ├── firebase.ts           # Firebase init
│       ├── db.ts                 # Firestore helpers
│       └── claude.ts             # Anthropic AI helpers
├── .env.local                    # Environment variables
├── vercel.json                   # Cron job config
└── README.md
```

---

## ✨ Features

| Feature | Status |
|---------|--------|
| AI Project Generation | ✅ Phase 1 |
| Monaco Code Editor | ✅ Phase 1 |
| Live Preview Runner | ✅ Phase 1 |
| Fix & Improve Loop | ✅ Phase 1 |
| Firebase Persistence | ✅ Phase 1 |
| Version History | ✅ Phase 1 |
| ZIP Export | ✅ Phase 1 |
| Task Queue | ✅ Phase 1 |
| Scheduled Tasks | ✅ Phase 1 |
| Background Agent Loop | ✅ Phase 1 |
| Projects Dashboard | ✅ Phase 1 |
| Email Notifications | 🔜 Phase 2 |
| Auth (Google login) | 🔜 Phase 2 |
| Electron Desktop App | 🔜 Phase 4 |

---

## 💰 Cost

- Vercel: **Free**
- Firebase: **Free tier**
- Anthropic API: **~$0.03 per generation**
- $5 of credits ≈ **150+ project generations**

---

Built with ❤️ by **The Palace, Inc.**
