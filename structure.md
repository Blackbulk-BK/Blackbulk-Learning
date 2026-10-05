blackbulk-learning/
├── public/
│   ├── favicon.ico                  # Browser tab icon
│   ├── logo.svg                     # Blackbulk Learning branding
│   └── (Static assets, images, icons)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   └── route.ts         # Secure server endpoint for Gemini API (Socratic tutor)
│   │   │   └── attendance/
│   │   │       └── route.ts         # Secure server endpoint writing scanned QR data to Google Sheets
│   │   ├── auth/
│   │   │   └── callback/
│   │   │       └── route.ts         # Handles the secure redirect after a user logs in with Gmail (SSO)
│   │   ├── login/
│   │   │   └── page.tsx             # Login screen (Email/Password + "Sign in with Google")
│   │   ├── dashboard/
│   │   │   └── page.tsx             # Protected: Student view showing notebooks and due flashcards
│   │   ├── notebook/
│   │   │   └── [id]/
│   │   │       └── page.tsx         # Protected: Main workspace (Socratic chat, sources, The Forge)
│   │   ├── teacher/
│   │   │   └── page.tsx             # Protected: Admin view for uploading syllabuses and analytics
│   │   ├── attendance/
│   │   │   └── page.tsx             # Protected: Web-based camera UI for scanning student QRs
│   │   ├── layout.tsx               # Main layout wrapping the app (Navbar, Auth state checking)
│   │   ├── page.tsx                 # Public landing page (Hero section, links to login)
│   │   └── globals.css              # Global CSS file (Tailwind CSS imports)
│   ├── components/
│   │   ├── ui/                      # Reusable UI elements
│   │   │   ├── Button.tsx
│   │   │   └── Input.tsx
│   │   ├── AuthForm.tsx             # Login/signup logic and Google SSO button UI
│   │   ├── ChatInterface.tsx        # UI for Socratic Q&A and inline citations
│   │   ├── FlashcardDeck.tsx        # UI for spaced repetition learning
│   │   ├── FileUploader.tsx         # Dropzone for PDFs, photos, and audio files
│   │   └── QRScanner.tsx            # Camera component for reading student codes
│   └── lib/
│       ├── supabase/
│       │   ├── client.ts            # Supabase connection for the browser (for login buttons)
│       │   └── server.ts            # Supabase connection for secure server routes (verifying sessions)
│       └── googleSheets.ts          # Server-side logic to format and append rows to Google Sheets
├── .env.local                       # Private keys (Gemini API, Supabase, Google Service Account)
├── .gitignore                       # Git ignore file (prevents uploading .env.local to GitHub)
├── next.config.mjs                  # Next.js specific configuration
├── tailwind.config.ts               # UI styling rules and design tokens
├── tsconfig.json                    # TypeScript configuration settings
└── package.json                     # List of installed project dependencies and scripts