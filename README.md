# SubTrackr

A full-stack personal finance platform built with Spring Boot 3, PostgreSQL, React Native (Expo), and Tauri. SubTrackr tracks recurring subscriptions, monitors e-commerce price drops via scheduled web scrapers, imports receipts from Gmail via OAuth, and assists with subscription cancellations using LLM-assisted email drafts.

## Table of Contents

- [Overview](#overview)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Core Features](#core-features)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Database Setup](#database-setup)
  - [Backend Configuration & Run](#backend-configuration--run)
  - [Frontend Configuration & Run](#frontend-configuration--run)
  - [Desktop Application (Tauri)](#desktop-application-tauri)
- [API Overview](#api-overview)
- [Security & Best Practices](#security--best-practices)
- [License](#license)

## Overview

SubTrackr combines subscription management and e-commerce price monitoring in a single unified dashboard. Users can keep track of renewal dates, detect overlapping streaming services, generate PDF spending reports, receive notifications before renewals occur, and monitor product URLs for discounts.

## Architecture & Tech Stack

### Backend
- **Language**: Java 21
- **Framework**: Spring Boot 3.2.3
- **Security**: Spring Security 6 with stateless JWT authentication (HMAC-SHA256)
- **Data Access**: Spring Data JPA, Hibernate 6, PostgreSQL driver, HikariCP connection pooling
- **Web Scraping**: Jsoup for HTML parsing and price extraction
- **Scheduling**: Spring Task Scheduling for periodic price checks, billing reminders, and daily digests
- **Integrations**:
  - Google OAuth2 & Gmail REST API for subscription import
  - Groq API (Llama 3) for automated cancellation and refund letter generation
  - Brevo (Sendinblue) REST API for transactional email delivery
  - Firebase Admin SDK for Cloud Messaging (push notifications)

### Frontend & Mobile
- **Core**: React Native 0.74 with Expo SDK 51
- **Navigation**: Expo Router (file-based routing)
- **Styling**: NativeWind v4 (Tailwind CSS)
- **State & Storage**: React Hooks, AsyncStorage, Axios interceptors with automatic token refresh
- **Notifications**: Expo Notifications (native Android/iOS) and Firebase Web Push Service Worker (web)
- **Exporting**: Expo Print for client-side PDF savings report rendering

### Desktop
- **Shell**: Tauri v1 (Rust) wrapping the compiled frontend assets

## Core Features

- **Subscription Management**: Add, update, and categorize recurring subscriptions with flexible billing cycles (weekly, monthly, quarterly, yearly). Automatic calculation of next billing dates and monthly equivalent costs.
- **Price Drop Tracker**: Track product URLs across major retailers (Amazon, Skroutz, BestPrice, and generic e-commerce stores). Background cron jobs monitor prices, record price history, and dispatch alerts when the current price drops below target thresholds.
- **Gmail Subscription Detection**: Connect via Google OAuth to scan recent confirmation receipts and automatically suggest subscriptions for one-click import.
- **AI Cancellation Drafter**: Generate formal cancellation, price reduction negotiation, or refund request emails using Groq Llama 3 models.
- **Analytics & Insights**: Monthly spend breakdowns by category, 6-month historical spend trends, and duplicate service detection (e.g., flagging multiple active video streaming plans).
- **Scheduled Notifications**: Background jobs process billing reminders 2 days ahead of renewals and price alerts immediately upon detection.
- **PDF Reports**: Export comprehensive annual savings reports with breakdown tables and metrics.

## Repository Structure

```text
.
├── backend/
│   ├── src/main/java/app/subtrackr/
│   │   ├── config/          # Security, CORS, Firebase, Native hints
│   │   ├── controller/      # REST API controllers
│   │   ├── dto/             # Request and response models
│   │   ├── entity/          # JPA database entities
│   │   ├── enums/           # Domain enumerations
│   │   ├── exception/       # Global exception handling
│   │   ├── repository/      # Spring Data JPA repositories
│   │   ├── scheduler/       # Automated background jobs
│   │   ├── security/        # JWT filter, user details, token provider
│   │   └── service/         # Business logic and external integrations
│   ├── src/main/resources/  # application.properties, DB schema
│   ├── Dockerfile           # Multi-stage Docker build
│   └── pom.xml              # Maven dependencies
├── subtrackr/
│   ├── app/                 # Expo Router screens ((auth), (tabs), root)
│   ├── assets/              # App icons, splash screens, favicon
│   ├── components/          # Reusable UI components
│   ├── lib/                 # API client, storage, push notifications, PDF
│   ├── public/              # Service worker and static web assets
│   ├── src-tauri/           # Rust Tauri desktop wrapper
│   ├── package.json         # Frontend dependencies and scripts
│   └── tailwind.config.js   # Tailwind CSS configuration
├── schema.sql               # PostgreSQL schema definition
└── LICENSE                  # Source license
```

## Getting Started

### Prerequisites

- Java Development Kit (JDK) 21 or higher
- Node.js 18.x or 20.x and npm
- PostgreSQL 14+ instance
- Rust and Cargo (optional, required only for Tauri desktop builds)

### Database Setup

Create a PostgreSQL database and initialize the tables using `schema.sql`:

```bash
psql -U postgres -d postgres -c "CREATE DATABASE subtrackr;"
psql -U postgres -d subtrackr -f schema.sql
```

### Backend Configuration & Run

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your database credentials and secret keys:
   ```properties
   DB_URL=jdbc:postgresql://localhost:5432/subtrackr
   DB_USERNAME=postgres
   DB_PASSWORD=your_password
   JWT_SECRET=your_minimum_256_bit_secret_key_here
   ```

4. Build and start the backend service:
   ```bash
   ./mvnw spring-boot:run
   ```
   The backend API will start on `http://localhost:8080`.

### Frontend Configuration & Run

1. Navigate to the `subtrackr` directory:
   ```bash
   cd subtrackr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the Expo development server:
   ```bash
   npx expo start
   ```

   - Press `w` to open in your web browser (`http://localhost:8081`).
   - Press `a` to open on an Android emulator or device via Expo Go.
   - Press `i` to open on an iOS simulator.

### Desktop Application (Tauri)

To launch the desktop application in development mode:

```bash
cd subtrackr
npm run tauri dev
```

## API Overview

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new user account | No |
| POST | `/api/auth/login` | Authenticate and obtain JWT tokens | No |
| POST | `/api/auth/refresh` | Refresh expired access token | No |
| GET | `/api/dashboard` | Fetch KPI metrics and upcoming renewals | Yes |
| GET | `/api/subscriptions` | List subscriptions with pagination and filter | Yes |
| POST | `/api/subscriptions` | Create a new subscription | Yes |
| PUT | `/api/subscriptions/{id}` | Update subscription details | Yes |
| DELETE | `/api/subscriptions/{id}` | Remove a subscription | Yes |
| GET | `/api/trackers` | List tracked products and price histories | Yes |
| POST | `/api/trackers` | Add product URL to tracker | Yes |
| POST | `/api/trackers/{id}/check` | Force on-demand price refresh | Yes |
| GET | `/api/insights` | Fetch spending analytics and duplicate alerts | Yes |
| POST | `/api/email-drafter/generate` | Generate cancellation or refund draft via LLM | Yes |
| GET | `/api/gmail/auth-url` | Generate Google OAuth authorization URL | Yes |
| POST | `/api/gmail/import` | Exchange OAuth code and import subscriptions | Yes |

## Security & Best Practices

- Passwords are encrypted using BCrypt with custom work factor.
- Stateless authentication using short-lived JWT access tokens and persistent refresh tokens.
- All secrets and credentials are fully externalized via environment variables.
- Database access uses parameterized queries via Spring Data JPA to prevent SQL injection.
- Production Docker image uses a minimal Eclipse Temurin JRE base with non-root runtime options.

## License

This project is licensed under the terms described in the [LICENSE](LICENSE) file.
