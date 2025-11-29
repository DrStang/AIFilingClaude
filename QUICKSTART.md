# Quick Start Guide

Get your AI Filing Cabinet app running in 10 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Expo CLI installed (`npm install -g expo-cli`)
- [ ] iOS Simulator (Mac) or Android Emulator set up
- [ ] Supabase account created
- [ ] AI API key obtained (Claude or OpenAI)

## Step-by-Step Setup

### 1. Install Dependencies (2 minutes)

```bash
npm install
```

### 2. Supabase Setup (3 minutes)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (~2 minutes)
3. Go to SQL Editor → New Query
4. Copy and paste the entire contents of `supabase/setup.sql`
5. Click "Run"
6. Go to Storage → Create new bucket
   - Name: `documents`
   - Public: **OFF** (private)
   - Create bucket
7. In the `documents` bucket, go to Policies → Add these 3 policies:

```sql
-- Policy 1: SELECT
CREATE POLICY "Users can read their own documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy 2: INSERT
CREATE POLICY "Users can upload their own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Policy 3: DELETE
CREATE POLICY "Users can delete their own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

8. Get your credentials:
   - Go to Settings → API
   - Copy `Project URL` and `anon public` key

### 3. AI API Key (1 minute)

**Option A: Anthropic Claude (Recommended)**
- Go to [console.anthropic.com](https://console.anthropic.com)
- Create an API key
- Copy it

**Option B: OpenAI GPT-4**
- Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Create new secret key
- Copy it

### 4. Environment Setup (1 minute)

```bash
cp .env.example .env
```

Edit `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Use ONE of these:
EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-xxxxx
# OR
EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxxx
```

### 5. Run the App (1 minute)

**iOS:**
```bash
npm run ios
```

**Android:**
```bash
npm run android
```

**Web:**
```bash
npm run web
```

### 6. Create Account & Test

1. App opens → Click "Sign up"
2. Enter email and password
3. Check email for verification link
4. Log in
5. Tap camera button to scan your first document!

## Troubleshooting

### "Supabase URL is not defined"
- Make sure `.env` file exists and has the correct values
- Restart the Expo dev server (`Ctrl+C` and run `npm start` again)

### "Network error" when uploading
- Check that Storage bucket is created
- Verify storage policies are added
- Make sure Supabase project isn't paused (free tier auto-pauses after inactivity)

### "API key invalid"
- Verify the API key is correct in `.env`
- For Claude: Make sure you have credits
- For OpenAI: Ensure you have GPT-4 API access

### Camera not working
- On iOS Simulator: Camera doesn't work - use "Choose from Library" instead
- On Android Emulator: Grant camera permission in app settings
- On real device: Grant permission when prompted

## Next Steps

1. Scan some documents to test the AI
2. Check the auto-generated names and metadata
3. Try searching for documents
4. View upcoming reminders
5. Customize settings

## Tips for Best Results

**For better OCR accuracy:**
- Use good lighting
- Hold camera steady
- Ensure document is flat
- Keep text clearly visible
- Avoid shadows and glare

**Document types that work well:**
- Receipts (stores, restaurants)
- Warranty cards
- Medical bills and prescriptions
- Tax forms (W-2, 1099)
- Car service records
- Insurance policies
- Contracts and agreements

**Search tips:**
- Search by vendor: "Costco", "Target"
- Search by amount: "$87" or "87.21"
- Search by date: "2024" or "January"
- Search by content: "oil change", "warranty"

## Support

Having issues? Check:
1. This Quick Start guide
2. Main README.md for detailed docs
3. Supabase dashboard for database/storage issues
4. Expo logs in terminal for error messages

## What's Included

- ✅ Document scanning with camera
- ✅ OCR text extraction
- ✅ AI auto-categorization
- ✅ Smart file naming
- ✅ Metadata extraction
- ✅ Full-text search
- ✅ Expiration reminders
- ✅ Biometric security
- ✅ iOS, Android, Web support

Enjoy your AI Filing Cabinet! 📁🤖
