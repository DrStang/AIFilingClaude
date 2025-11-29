# AI Filing Cabinet - Technical Architecture

## Overview

AI Filing Cabinet is a cross-platform mobile application built with React Native (Expo) that uses AI to automatically scan, categorize, and organize documents with intelligent reminders.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     iOS      │  │   Android    │  │     Web      │      │
│  │   (Native)   │  │   (Native)   │  │    (PWA)     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │         React Native (Expo)                        │     │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────┐  │     │
│  │  │  Expo       │  │  Expo Camera │  │  Expo    │  │     │
│  │  │  Router     │  │  Image Picker│  │  Secure  │  │     │
│  │  │             │  │  Image       │  │  Store   │  │     │
│  │  │             │  │  Manipulator │  │          │  │     │
│  │  └─────────────┘  └──────────────┘  └──────────┘  │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Document   │  │      AI      │  │     Auth     │      │
│  │   Service    │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
           │                   │                  │
           ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend Layer                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │              Supabase                              │     │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │     │
│  │  │PostgreSQL│  │  Storage │  │     Auth     │     │     │
│  │  │          │  │  (S3-like)│  │   (JWT)      │     │     │
│  │  │  - docs  │  │           │  │              │     │     │
│  │  │  - reminders│ │  - images │  │  - Email/PW │     │     │
│  │  │  - prefs │  │  - thumbs │  │  - Biometric│     │     │
│  │  └──────────┘  └──────────┘  └──────────────┘     │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     AI Layer                                 │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Anthropic  │      OR      │    OpenAI    │            │
│  │   Claude     │              │    GPT-4o    │            │
│  │              │              │              │            │
│  │  - OCR       │              │  - OCR       │            │
│  │  - Analysis  │              │  - Analysis  │            │
│  │  - Metadata  │              │  - Metadata  │            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React Native 0.73 with Expo 50
- **Language**: TypeScript 5.3
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand
- **UI Components**: React Native built-in + Expo modules
- **Icons**: Expo Vector Icons (Ionicons)
- **Date Handling**: date-fns

### Backend
- **BaaS**: Supabase
  - **Database**: PostgreSQL 15+
  - **Storage**: S3-compatible object storage
  - **Authentication**: Supabase Auth (JWT-based)
  - **Real-time**: PostgreSQL replication (future feature)

### AI Services
- **Primary**: Anthropic Claude 3.5 Sonnet
  - Vision API for OCR
  - Text analysis for categorization
- **Alternative**: OpenAI GPT-4o
  - Vision API for OCR
  - JSON mode for structured output

### Security
- **Encryption in Transit**: TLS 1.3
- **Encryption at Rest**: Supabase default encryption
- **Authentication**: Email/Password + Biometric (FaceID/TouchID)
- **Authorization**: Row-Level Security (RLS) policies
- **API Keys**: Expo SecureStore (platform keychain)

## Data Flow

### Document Upload Flow

```
1. User captures photo
   ↓
2. Image optimization (resize, compress)
   ↓
3. Convert to base64
   ↓
4. AI OCR (extract text)
   ↓
5. AI Analysis (categorize, extract metadata)
   ↓
6. Upload image to Supabase Storage
   ↓
7. Create thumbnail
   ↓
8. Upload thumbnail
   ↓
9. Insert document record to PostgreSQL
   ↓
10. Create reminders (if applicable)
   ↓
11. Return result to user
```

### Search Flow

```
1. User enters search query
   ↓
2. Query sent to Supabase
   ↓
3. PostgreSQL full-text search
   - Search in auto_generated_name
   - Search in ocr_text
   - Use GIN indexes
   ↓
4. Return matching documents
   ↓
5. Display results with thumbnails
```

## Database Schema

### Tables

**documents**
- Primary table for document metadata
- Stores OCR text, metadata, file references
- Indexed for fast search

**reminders**
- Links to documents
- Tracks expiration dates
- Supports multiple reminder types

**user_preferences**
- User settings
- Biometric preferences
- Notification settings

### Relationships

```
users (auth.users)
  │
  ├─── documents (1:many)
  │      │
  │      └─── reminders (1:many)
  │
  └─── user_preferences (1:1)
```

## File Structure

```
AIFilingClaude/
├── app/                          # Expo Router pages
│   ├── (auth)/                  # Auth group
│   │   ├── login.tsx            # Login screen
│   │   └── signup.tsx           # Signup screen
│   ├── (tabs)/                  # Main tabs group
│   │   ├── index.tsx            # Documents list
│   │   ├── search.tsx           # Search screen
│   │   ├── reminders.tsx        # Reminders screen
│   │   └── settings.tsx         # Settings screen
│   ├── document/                # Dynamic routes
│   │   └── [id].tsx             # Document detail
│   ├── camera.tsx               # Camera/scanner
│   ├── index.tsx                # Root redirect
│   └── _layout.tsx              # Root layout
├── lib/                         # Core services
│   ├── supabase.ts              # Supabase client
│   ├── database.types.ts        # TypeScript types
│   ├── ai-service.ts            # AI OCR/analysis
│   └── document-service.ts      # Document CRUD
├── stores/                      # State management
│   └── auth-store.ts            # Auth state (Zustand)
├── supabase/                    # Database setup
│   └── setup.sql                # Schema & policies
├── scripts/                     # Utility scripts
│   ├── generate-assets.sh       # Asset generator (bash)
│   └── generate-assets.py       # Asset generator (Python)
└── assets/                      # App assets
    ├── icon.png
    ├── adaptive-icon.png
    ├── splash.png
    └── favicon.png
```

## Key Design Decisions

### Why Expo?
- Cross-platform (iOS, Android, Web) from single codebase
- Managed workflow simplifies deployment
- Rich ecosystem of modules
- Over-the-air updates

### Why Supabase?
- Open-source Firebase alternative
- PostgreSQL (powerful, familiar)
- Built-in auth and storage
- Row-level security
- Generous free tier
- Self-hostable

### Why AI Vision APIs?
- More accurate than traditional OCR (Tesseract)
- Understands context and semantics
- Can extract structured data
- Handles handwriting better
- Continuously improving

### Why Client-Side AI Processing?
- Simpler architecture (no backend functions needed)
- Lower latency (direct API calls)
- Easier to debug
- Cost-effective for MVP
- Can move to edge functions later

## Performance Optimizations

### Image Optimization
- Resize images before upload (max 1920px width)
- JPEG compression (0.8 quality)
- Thumbnail generation (300px width)
- Lazy loading in lists

### Database
- GIN indexes for full-text search
- Indexes on user_id for fast filtering
- Indexes on dates for reminder queries
- RLS policies prevent full table scans

### Caching
- SecureStore for auth tokens
- In-memory state management with Zustand
- Image caching by React Native

## Security Considerations

### Data Protection
- All API calls over HTTPS
- RLS policies prevent cross-user access
- Storage policies restrict access to user's own files
- API keys stored in SecureStore (encrypted keychain)

### Authentication
- JWT tokens with automatic refresh
- Biometric authentication (optional)
- Email verification required
- Secure password requirements (6+ chars)

### Privacy
- No third-party analytics
- No data sharing
- User data isolated by RLS
- Can self-host Supabase

## Scalability

### Current Limits
- Supabase free tier: 500MB storage, 2GB bandwidth/month
- AI API rate limits vary by provider
- No server-side processing limits

### Scaling Strategy
1. **Horizontal**: Multiple Supabase projects (sharding by user cohort)
2. **Vertical**: Upgrade Supabase tier (more storage, bandwidth)
3. **Caching**: Add CDN for static assets
4. **Processing**: Move AI to Supabase Edge Functions (Deno)
5. **Search**: Add Algolia/Meilisearch for advanced search

## Future Enhancements

### Technical Improvements
- [ ] Offline support (local SQLite + sync)
- [ ] Background document processing
- [ ] Batch upload optimization
- [ ] WebSocket for real-time updates
- [ ] Progressive Web App (PWA) features
- [ ] End-to-end encryption option

### Infrastructure
- [ ] Edge Functions for AI processing
- [ ] CDN for thumbnails
- [ ] Automated backups
- [ ] Monitoring and alerting
- [ ] CI/CD pipeline

## Testing Strategy

### Unit Tests
- AI service functions
- Document service CRUD
- Metadata extraction logic
- Search query building

### Integration Tests
- Supabase connection
- AI API integration
- Image upload/download
- Auth flow

### E2E Tests
- Document scanning flow
- Search functionality
- Reminder creation
- Settings management

## Deployment

### Development
```bash
npm start
```

### Preview (Expo Go)
```bash
expo publish
```

### Production Build

**iOS:**
```bash
eas build --platform ios
eas submit --platform ios
```

**Android:**
```bash
eas build --platform android
eas submit --platform android
```

**Web:**
```bash
npm run build:web
# Deploy to Vercel, Netlify, or static host
```

## Monitoring

### Metrics to Track
- Upload success rate
- OCR accuracy (manual review)
- Search query performance
- API error rates
- User retention
- Storage usage per user

### Tools
- Supabase Dashboard (database metrics)
- Expo Analytics (app usage)
- Sentry (error tracking) - future
- LogRocket (session replay) - future

## Cost Estimation

### Free Tier (MVP)
- Supabase: Free (500MB storage)
- Anthropic: $5-20/month (500-2000 documents)
- OpenAI: $10-40/month (500-2000 documents)
- Expo: Free (development)

### Paid Tier (1000 users)
- Supabase Pro: $25/month
- AI APIs: ~$500/month
- Expo EAS: $29/month
- Total: ~$554/month

## Contributing

See CONTRIBUTING.md for development guidelines.

## License

MIT - see LICENSE file
