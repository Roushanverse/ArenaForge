# ArenaForge - Full-Stack Tournament Platform

ArenaForge is a production-grade, full-stack tournament platform for Free Fire-style esports. It allows admins to create and manage tournaments, and players to register, pay entry fees, and compete for prizes.

This project is built with a modern tech stack, focusing on security, real-time features, and a clean user experience.

## Tech Stack

-   **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
-   **Backend:** Supabase (Postgres, Auth, Storage, Realtime, Edge Functions)
-   **Payments:** Razorpay
-   **Testing:** Playwright (for E2E tests)

## Features

-   **Player Authentication:** Secure signup with mobile OTP and login (mobile/password or OTP).
-   **Admin Panel:** Full CRUD for tournaments, player management, and winner announcements.
-   **Tournament Management:** Create tournaments with custom rules, prize pools, and entry fees.
-   **Payment Integration:** Server-side Razorpay integration for secure and reliable payments.
-   **Real-time Chat:** Global and per-tournament chat rooms using Supabase Realtime.
-   **Player Dashboards:** View upcoming, joined, and past tournaments, as well as winnings.
-   **Secure by Design:** Strong Row Level Security (RLS) policies on the database and secure server-side logic.

## Project Structure

```
.
├── frontend/         # React + Vite Frontend Application
├── supabase/
│   ├── functions/    # Supabase Edge Functions (Deno)
│   │   ├── create-order/
│   │   ├── razorpay-webhook/
│   │   └── ...
│   └── migrations/   # SQL Database Migrations
│       └── 001_init.sql
└── README.md
```

## Setup and Deployment

### 1. Supabase Backend Setup

1.  **Create a Supabase Project:** Go to [supabase.com](https://supabase.com) and create a new project.
2.  **Get Project Credentials:** In your project dashboard, navigate to `Settings` > `API`. You will need the **Project URL** and the **`anon` public key**. You will also need the **`service_role` secret key** for server-side operations.
3.  **Run SQL Migrations:**
    *   Go to the `SQL Editor` in your Supabase dashboard.
    *   Copy the entire content of `supabase/migrations/001_init.sql`.
    *   Paste it into the SQL editor and click `Run`. This will create all the necessary tables, functions, and RLS policies.
4.  **Set up Environment Variables for Edge Functions:**
    *   You need to set secrets for your edge functions locally using a `.env` file in the `supabase` directory or directly in the Supabase dashboard for deployment.
    *   Navigate to `Edge Functions` > `Settings` and add the following secrets:
        -   `SUPABASE_URL`: Your project URL.
        -   `SUPABASE_ANON_KEY`: Your project's anon key.
        -   `SUPABASE_SERVICE_ROLE_KEY`: Your project's service role key.
        -   `RAZORPAY_KEY_ID`: Your Razorpay Key ID.
        -   `RAZORPAY_KEY_SECRET`: Your Razorpay Key Secret.
        -   `RAZORPAY_WEBHOOK_SECRET`: The secret you configure in the Razorpay dashboard for webhook verification.
5.  **Deploy Edge Functions:**
    *   Install the Supabase CLI: `npm install -g supabase`.
    *   Login to your account: `supabase login`.
    *   Link your project: `supabase link --project-ref <your-project-id>`.
    *   Deploy the functions: `supabase functions deploy --no-verify-jwt`.

### 2. Frontend Application Setup

**Note:** The following steps describe how to assemble the frontend application using the provided code snippets, as the development environment encountered an issue preventing automated setup.

1.  **Scaffold a Vite Project:**
    ```bash
    npm create vite@latest frontend -- --template react-ts
    cd frontend
    ```
2.  **Install Dependencies:**
    ```bash
    npm install
    npm install -D tailwindcss postcss autoprefixer
    npx tailwindcss init -p
    npm install @supabase/supabase-js react-router-dom @tanstack/react-query react-hook-form zod @hookform/resolvers/zod framer-motion lucide-react clsx tailwind-merge shadcn-ui
    ```
3.  **Configure Tailwind CSS:**
    *   Replace the content of `tailwind.config.js` and `src/index.css` with the provided code for those files.
4.  **Create Environment Variables:**
    *   Create a file named `.env.local` in the `frontend` directory.
    *   Add your Supabase client-side credentials:
        ```
        VITE_SUPABASE_URL=https://your-project-id.supabase.co
        VITE_SUPABASE_ANON_KEY=your-anon-key
        ```
5.  **Populate `src` Directory:**
    *   Create the necessary directories (`components`, `pages`, `lib`, `hooks`, etc.) inside `src`.
    *   Create each `.tsx` or `.ts` file and copy the provided code into it.
6.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

### 3. Razorpay Setup

1.  **Create a Razorpay Account:** Sign up for a Razorpay account if you don't have one.
2.  **Generate API Keys:** Go to `Settings` > `API Keys` to get your `Key ID` and `Key Secret`.
3.  **Set up a Webhook:**
    *   Go to `Settings` > `Webhooks`.
    *   Click `Add New Webhook`.
    *   Set the **Webhook URL** to your deployed `razorpay-webhook` edge function URL (e.g., `https://<project-id>.supabase.co/functions/v1/razorpay-webhook`).
    *   Enter a **Webhook Secret**. This secret must be added to your Edge Function environment variables as `RAZORPAY_WEBHOOK_SECRET`.
    *   Under `Active Events`, select `payment.captured` and `payment.failed`.

## Security Checklist

-   [x] **Never expose `service_role` key on the client side.** It should only be used in secure server environments like Edge Functions.
-   [x] **Enable Row Level Security (RLS) on all tables.** The provided migration file enables RLS and sets up strong default policies.
-   [x] **Use server-side payment verification.** The `razorpay-webhook` function verifies the payment signature from Razorpay, which is the only reliable way to confirm a payment. Do not trust the client-side callback alone.
-   [x] **Protect admin routes and functions.** Admin operations are protected by checking the user's role, which should be securely assigned.
-   [x] **Encrypt sensitive data.** The `room_pass` for tournaments is stored encrypted and should only be decrypted and delivered to authenticated, joined players.
-   [x] **Manage secrets securely.** Use environment variables for all secrets and keys. Do not hardcode them in the source code. Use the secret management tools provided by your deployment platform (e.g., Vercel, Netlify, Supabase).
-   [x] **Validate all user input.** Use libraries like Zod for schema validation on both the client and server to prevent invalid data from entering your system.