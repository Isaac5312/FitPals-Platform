````markdown
# FitPals Backend Architecture

## Overview
FitPals Platform Backend is built with Node.js and Express, designed as a scalable, modular REST API for a fitness and wellness social platform.

## Technology Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Caching**: Redis
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Validation**: express-validator
- **Image Upload**: Cloudinary
- **Email**: Nodemailer
- **Task Queue**: Bull

## Directory Structure
\`\`\`
server/
├── config/              # Configuration files
│   ├── database.js      # MongoDB connection
│   └── redis.js         # Redis connection
├── middleware/          # Express middleware
│   ├── auth.js          # Authentication & authorization
│   └── errorHandler.js  # Error handling
├── models/              # Mongoose schemas
│   ├── User.js          # User model
│   ├── Activity.js      # Activity/workout log
│   ├── Workout.js       # Workout template
│   └── Challenge.js     # Challenge/competition
├── routes/              # API routes
│   └── auth.js          # Authentication routes
├── services/            # Business logic
│   └── normalizationService.js  # Data normalization
├── utils/               # Utility functions
│   ├── logger.js        # Logging utility
│   └── errorHandler.js  # Error classes
├── server.js            # Main server file
├── package.json         # Dependencies
└── .env.example         # Environment variables template
\`\`\`

## Core Features

### 1. User Management
- User registration and authentication
- JWT-based authorization
- User profiles with fitness preferences
- Social features (followers/following)
- Role-based access control (user, trainer, admin)

### 2. Activity Tracking
- Log fitness activities (running, cycling, swimming, etc.)
- Track distance, duration, calories
- Geospatial location support
- Activity sharing with visibility controls
- Comments and likes on activities

### 3. Workout Management
- Create and share workout plans
- Exercise library with sets, reps, weight tracking
- Difficulty levels and target muscles
- Ratings and comments system
- Save/bookmark workouts

### 4. Challenges & Competitions
- Create time-based fitness challenges
- Track participant progress
- Leaderboard system
- Multiple challenge types (distance, duration, count, calories)

### 5. Social Features
- Follow/unfollow users
- Activity feed
- Comments and likes
- User profiles
- Activity visibility controls

## Models

### User Schema
\`\`\`
{
  firstName, lastName, email, password,
  avatar, bio, role, fitnessLevel,
  preferences, isEmailVerified, isActive,
  lastLogin, socialLinks,
  followers, following
}
\`\`\`

### Activity Schema
\`\`\`
{
  user, type, title, description,
  distance, duration, calories,
  startTime, endTime, location,
  intensity, photos, likes, comments,
  visibility, metadata
}
\`\`\`

### Workout Schema
\`\`\`
{
  creator, title, description, category,
  difficulty, exercises[], duration,
  targetMuscles, equipment,
  isPublic, likes, comments, savedBy, ratings
}
\`\`\`

### Challenge Schema
\`\`\`
{
  title, description, creator, type,
  goal, startDate, endDate, category,
  participants[], prizes, status,
  isPublic, maxParticipants, leaderboard
}
\`\`\`

## API Endpoints

### Authentication
- \`POST /api/auth/register\` - Register new user
- \`POST /api/auth/login\` - Login user
- \`POST /api/auth/refresh\` - Refresh token
- \`POST /api/auth/logout\` - Logout user

### Users (To be implemented)
- \`GET /api/users/:id\` - Get user profile
- \`PUT /api/users/:id\` - Update profile
- \`POST /api/users/:id/follow\` - Follow user
- \`POST /api/users/:id/unfollow\` - Unfollow user

### Activities (To be implemented)
- \`POST /api/activities\` - Create activity
- \`GET /api/activities\` - Get activities feed
- \`GET /api/activities/:id\` - Get activity details
- \`PUT /api/activities/:id\` - Update activity
- \`DELETE /api/activities/:id\` - Delete activity
- \`POST /api/activities/:id/like\` - Like activity
- \`POST /api/activities/:id/comment\` - Comment on activity

### Workouts (To be implemented)
- \`POST /api/workouts\` - Create workout
- \`GET /api/workouts\` - List workouts
- \`GET /api/workouts/:id\` - Get workout
- \`PUT /api/workouts/:id\` - Update workout
- \`DELETE /api/workouts/:id\` - Delete workout

### Challenges (To be implemented)
- \`POST /api/challenges\` - Create challenge
- \`GET /api/challenges\` - List challenges
- \`POST /api/challenges/:id/join\` - Join challenge
- \`GET /api/challenges/:id/leaderboard\` - Get leaderboard

## Middleware

### Authentication
- \`authenticate\` - Verify JWT token
- \`authorize(roles)\` - Check user role
- \`optionalAuth\` - Optional authentication

### Error Handling
- Global error handler with proper HTTP status codes
- Validation error formatting
- MongoDB error handling (duplicate keys, validation)

## Services

### Normalization Service
Standardizes data format across the API:
- \`normalizeUser()\` - Format user data
- \`normalizeActivity()\` - Format activity data
- \`normalizeWorkout()\` - Format workout data
- \`normalizeChallenge()\` - Format challenge data
- \`normalizePagination()\` - Format paginated responses
- \`normalizeError()\` - Format error responses
- \`normalizeSuccess()\` - Format success responses

## Environment Variables

Required:
- \`MONGODB_URI\` - MongoDB connection string
- \`JWT_SECRET\` - Secret key for JWT
- \`PORT\` - Server port (default: 5000)

Optional:
- \`REDIS_URL\` - Redis connection
- \`CLOUDINARY_*\` - Image upload credentials
- \`SMTP_*\` - Email configuration
- \`STRIPE_*\` - Payment integration

## Getting Started

### Installation
\`\`\`bash
cd server
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
\`\`\`

### Development
\`\`\`bash
npm run dev        # Start with nodemon
npm run lint       # Run linter
npm run lint:fix   # Fix linting issues
npm test           # Run tests
\`\`\`

## Future Enhancements
- Push notifications
- Real-time updates with WebSocket
- Advanced analytics dashboard
- Payment integration (Stripe)
- Third-party integrations (Strava, Fitbit)
- Machine learning recommendations
- Video content support
- Live streaming workouts
````
