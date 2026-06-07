# FitPals Backend API Routes Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication Routes

### Register User
```
POST /auth/register
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "confirmPassword": "securePassword123"
}

Response: 201
{
  "success": true,
  "message": "User registered successfully",
  "token": "eyJhbGc...",
  "user": {...}
}
```

### Login User
```
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}

Response: 200
{
  "success": true,
  "message": "Logged in successfully",
  "token": "eyJhbGc...",
  "user": {...}
}
```

## User Routes

### Get User Profile
```
GET /users/:id

Response: 200
{
  "success": true,
  "data": {
    "id": "userId",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "avatar": "url",
    "bio": "Fitness enthusiast",
    "fitnessLevel": "intermediate",
    "followers": 50,
    "following": 30
  }
}
```

### Update User Profile
```
PUT /users/:id
Authorization: Bearer token
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Smith",
  "bio": "Updated bio",
  "fitnessLevel": "advanced"
}

Response: 200
```

### Delete User Account
```
DELETE /users/:id
Authorization: Bearer token

Response: 200
{
  "success": true,
  "message": "Account deleted successfully"
}
```

### Follow User
```
POST /users/:id/follow
Authorization: Bearer token

Response: 200
{
  "success": true,
  "message": "User followed successfully"
}
```

### Unfollow User
```
POST /users/:id/unfollow
Authorization: Bearer token

Response: 200
{
  "success": true,
  "message": "User unfollowed successfully"
}
```

### Get User Followers
```
GET /users/:id/followers?page=1&limit=10

Response: 200
{
  "success": true,
  "data": [...]
}
```

### Search Users
```
GET /users/search/query?q=john&page=1&limit=10

Response: 200
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

## Activity Routes

### Create Activity
```
POST /activities
Authorization: Bearer token
Content-Type: application/json

{
  "type": "running",
  "title": "Morning Run",
  "description": "Great weather for running",
  "startTime": "2024-01-15T06:00:00Z",
  "endTime": "2024-01-15T06:45:00Z",
  "duration": 45,
  "distance": 7.5,
  "calories": 450,
  "intensity": "moderate",
  "visibility": "public"
}

Response: 201
```

### Get Activity Feed
```
GET /activities/feed/all?page=1&limit=10
Authorization: Bearer token

Response: 200
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

### Get Activity Details
```
GET /activities/:id

Response: 200
{
  "success": true,
  "data": {
    "id": "activityId",
    "type": "running",
    "title": "Morning Run",
    "distance": 7.5,
    "duration": 45,
    "calories": 450,
    "likes": 12,
    "comments": 3
  }
}
```

### Update Activity
```
PUT /activities/:id
Authorization: Bearer token
Content-Type: application/json

{
  "title": "Updated Title",
  "distance": 8.0,
  "calories": 480
}

Response: 200
```

### Delete Activity
```
DELETE /activities/:id
Authorization: Bearer token

Response: 200
```

### Like Activity
```
POST /activities/:id/like
Authorization: Bearer token

Response: 200
{
  "success": true,
  "data": { "likes": 13 }
}
```

### Comment on Activity
```
POST /activities/:id/comment
Authorization: Bearer token
Content-Type: application/json

{
  "text": "Great workout!"
}

Response: 201
{
  "success": true,
  "data": { "comments": 4 }
}
```

## Workout Routes

### Create Workout
```
POST /workouts
Authorization: Bearer token
Content-Type: application/json

{
  "title": "Full Body Strength",
  "description": "Complete strength training routine",
  "category": "strength",
  "difficulty": "intermediate",
  "duration": 60,
  "exercises": [
    {
      "name": "Squats",
      "sets": 3,
      "reps": 10,
      "weight": 100
    }
  ],
  "targetMuscles": ["legs", "glutes"],
  "equipment": ["dumbbells"],
  "isPublic": true
}

Response: 201
```

### Get All Workouts
```
GET /workouts?page=1&limit=10&category=strength&difficulty=intermediate&search=strength

Response: 200
{
  "success": true,
  "data": [...],
  "pagination": {...}
}
```

### Rate Workout
```
POST /workouts/:id/rate
Authorization: Bearer token
Content-Type: application/json

{
  "rating": 5
}

Response: 200
{
  "success": true,
  "data": {
    "averageRating": 4.5,
    "totalRatings": 20
  }
}
```

## Challenge Routes

### Create Challenge
```
POST /challenges
Authorization: Bearer token
Content-Type: application/json

{
  "title": "Marathon Challenge",
  "description": "Run 42km in 30 days",
  "type": "distance",
  "category": "running",
  "goal": {
    "value": 42,
    "unit": "km"
  },
  "startDate": "2024-02-01T00:00:00Z",
  "endDate": "2024-02-28T23:59:59Z",
  "maxParticipants": 100,
  "isPublic": true
}

Response: 201
```

### Join Challenge
```
POST /challenges/:id/join
Authorization: Bearer token

Response: 200
{
  "success": true,
  "data": { "participants": 46 }
}
```

### Update Progress
```
PUT /challenges/:id/progress
Authorization: Bearer token
Content-Type: application/json

{
  "value": 25
}

Response: 200
{
  "success": true,
  "data": {
    "value": 25,
    "percentage": 59.52
  }
}
```

### Get Leaderboard
```
GET /challenges/:id/leaderboard

Response: 200
{
  "success": true,
  "data": [
    {
      "rank": 1,
      "user": {...},
      "progress": 42
    }
  ]
}
```

## Health Check

### API Health
```
GET /health

Response: 200
{
  "success": true,
  "message": "FitPals API is running",
  "timestamp": "2024-01-15T12:30:00Z"
}
```
