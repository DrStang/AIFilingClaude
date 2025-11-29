# AI Filing Cabinet

An intelligent document management system that uses AI to automatically scan, categorize, and organize your documents with smart reminders for important dates.

## Features

### MVP Features (Current)

**1. AI Document Ingestion**
- Camera scanner with auto-cropping capabilities
- OCR using AI vision models (Claude or GPT-4o)
- Auto-detection of document types:
  - Receipt
  - Warranty
  - Medical
  - Tax
  - Contract
  - Car service record
  - Insurance
  - Miscellaneous

**2. Auto-Naming Engine**
- Generates descriptive filenames based on document content
- Examples:
  - "2024-10-12 Costco Receipt — $87.21"
  - "Honda Accord Brake Service — 68k miles — Jan 2025"
  - "iPhone 15 Warranty — Expires Sep 2026"

**3. Smart Metadata Extraction**
- Automatically extracts:
  - Dates
  - Amounts and currency
  - Vendor/business names
  - Categories
  - Renewal dates
  - Serial numbers
  - Product names
  - Policy numbers
  - And more...

**4. Secure Storage**
- Cloud storage with Supabase
- Row-level security (RLS)
- Biometric lock (FaceID/TouchID)
- Encrypted data transmission

**5. Full-Text Search**
- Search through document names
- Search through OCR text
- Natural language queries like:
  - "find my Honda tires receipt"
  - "show all medical papers from 2023"

**6. Expiration & Reminder Engine**
- Warranty expiring soon
- Insurance renewal dates
- Lease expiration
- Tax filing deadlines
- Medical follow-up reminders
- Car maintenance schedules

**7. Cross-Platform**
- iOS (native)
- Android (native)
- Web (PWA ready)

## Tech Stack

- **Frontend**: React Native (Expo) with TypeScript
- **Backend**: Supabase (PostgreSQL, Storage, Auth)
- **AI/ML**: Claude 3.5 Sonnet or GPT-4o for OCR and analysis
- **State Management**: Zustand
- **Navigation**: Expo Router
- **UI Components**: React Native built-in + Expo modules

## Prerequisites

- Node.js 18+ and npm/yarn
- Expo CLI (`npm install -g expo-cli`)
- A Supabase account (free tier works)
- An AI API key (Anthropic Claude or OpenAI GPT-4)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo-url>
cd AIFilingClaude
npm install
```

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)

2. Go to the SQL Editor and run the setup script:
   ```bash
   # Copy the contents of supabase/setup.sql and run it in the SQL Editor
   ```

3. Create a Storage Bucket:
   - Go to Storage section in Supabase dashboard
   - Create a new bucket named `documents`
   - Set it to **private** (not public)

4. Set up Storage Policies:
   - In the Storage section, go to Policies for the `documents` bucket
   - Add these policies:

   **SELECT (read) policy:**
   ```sql
   CREATE POLICY "Users can read their own documents"
   ON storage.objects FOR SELECT
   USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

   **INSERT policy:**
   ```sql
   CREATE POLICY "Users can upload their own documents"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

   **DELETE policy:**
   ```sql
   CREATE POLICY "Users can delete their own documents"
   ON storage.objects FOR DELETE
   USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

5. Get your Supabase credentials:
   - Go to Project Settings → API
   - Copy the `Project URL` and `anon/public` key

### 3. AI API Setup

Choose one of the following:

**Option A: Using Anthropic Claude (Recommended)**
1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. Note: Claude 3.5 Sonnet provides excellent OCR and analysis

**Option B: Using OpenAI GPT-4**
1. Get an API key from [platform.openai.com](https://platform.openai.com)
2. Note: GPT-4o (GPT-4 with vision) is required

### 4. Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Choose ONE of these:
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-xxxxx
# OR
EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxxx

EXPO_PUBLIC_ENVIRONMENT=development
```

### 5. Run the App

**For iOS:**
```bash
npm run ios
```

**For Android:**
```bash
npm run android
```

**For Web:**
```bash
npm run web
```

**Development mode:**
```bash
npm start
```

Then press:
- `i` for iOS simulator
- `a` for Android emulator
- `w` for web browser

## Project Structure

```
AIFilingClaude/
├── app/                    # Expo Router pages
│   ├── (auth)/            # Authentication screens
│   │   ├── login.tsx
│   │   └── signup.tsx
│   ├── (tabs)/            # Main app tabs
│   │   ├── index.tsx      # Documents list
│   │   ├── search.tsx     # Search screen
│   │   ├── reminders.tsx  # Reminders screen
│   │   └── settings.tsx   # Settings screen
│   ├── document/          # Document detail
│   │   └── [id].tsx
│   ├── camera.tsx         # Camera/scanner screen
│   ├── index.tsx          # Root redirect
│   └── _layout.tsx        # Root layout
├── lib/                   # Core logic
│   ├── supabase.ts        # Supabase client
│   ├── database.types.ts  # TypeScript types
│   ├── ai-service.ts      # AI OCR and analysis
│   └── document-service.ts # Document operations
├── stores/                # State management
│   └── auth-store.ts      # Auth state (Zustand)
├── supabase/              # Database setup
│   └── setup.sql          # Database schema
├── .env.example           # Environment variables template
├── package.json
└── README.md
```

## How It Works

### Document Processing Flow

1. **User captures/uploads a photo**
   - Via camera or photo library
   - Image is optimized and compressed

2. **AI performs OCR**
   - Extracts all text from the image
   - Returns structured text data

3. **AI analyzes the document**
   - Determines document type
   - Extracts metadata (dates, amounts, etc.)
   - Generates a descriptive filename

4. **Document is stored**
   - Original image uploaded to Supabase Storage
   - Thumbnail created and uploaded
   - Metadata saved to PostgreSQL database

5. **Smart reminders created**
   - If expiration dates found, reminders are auto-created
   - Warranty expirations
   - Insurance renewals
   - Service schedules
   - Contract end dates

6. **Full-text search enabled**
   - Both filename and OCR text are searchable
   - PostgreSQL full-text search with GIN indexes

## Usage Guide

### Scanning a Document

1. Tap the camera button (blue FAB) on the home screen
2. Point your camera at the document
3. Tap the capture button
4. Wait for AI processing (5-10 seconds)
5. Review the auto-generated name and metadata
6. Document is saved and searchable immediately

### Searching Documents

1. Go to the Search tab
2. Enter any text (vendor name, amount, date, etc.)
3. Results show matches in both filenames and OCR text

### Managing Reminders

1. Go to the Reminders tab
2. View upcoming expirations and renewals
3. Tap a reminder to view the document
4. Mark as complete when done

## Security & Privacy

- **Authentication**: Email/password with optional biometric lock
- **Data Encryption**: All data encrypted in transit (HTTPS/TLS)
- **Row-Level Security**: Users can only access their own data
- **API Keys**: Stored securely using Expo SecureStore
- **Storage**: Private storage bucket with user-specific folders
- **No Third-Party Tracking**: Zero analytics or tracking scripts

## Troubleshooting

### Camera not working
- Check permissions in Settings → App Permissions
- On iOS: Grant camera access in Settings → Privacy → Camera
- On Android: Grant camera access when prompted

### OCR failing or inaccurate
- Ensure good lighting when taking photos
- Hold camera steady
- Make sure document is flat and in focus
- Check that AI API key is valid and has credits

### Uploads failing
- Check internet connection
- Verify Supabase Storage bucket is created
- Confirm storage policies are set up correctly
- Check Supabase project isn't paused (free tier)

### Search not working
- Ensure database indexes are created (check setup.sql)
- Try refreshing the documents list
- Check that OCR text was extracted (view document details)

## Future Features (Roadmap)

### V2 Features
- [ ] Folder hierarchy and organization
- [ ] Family/sharing mode
- [ ] Bulk upload from camera roll
- [ ] Auto-import email attachments
- [ ] Tags and custom categories
- [ ] Export documents as PDF/ZIP

### V3 Features
- [ ] Smart tax prep mode
- [ ] Expense summaries and reports
- [ ] Mileage tracking
- [ ] Car maintenance predictions
- [ ] Export to TurboTax, H&R Block
- [ ] Full API for integrations
- [ ] Desktop apps (Windows, macOS)
- [ ] Browser extension for saving receipts
- [ ] Receipt forwarding email address

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check the troubleshooting section above
- Review Supabase and Expo documentation

## Acknowledgments

- Built with [Expo](https://expo.dev)
- Powered by [Supabase](https://supabase.com)
- AI by [Anthropic Claude](https://anthropic.com) or [OpenAI](https://openai.com)
- Icons from [Ionicons](https://ionic.io/ionicons)
