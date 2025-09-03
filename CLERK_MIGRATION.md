# NextAuth.js to Clerk Migration

This document outlines the completed migration from NextAuth.js to Clerk for PromptBridge authentication.

## ✅ Migration Steps Completed

### 1. Dependencies Updated
- ✅ Removed `next-auth` package
- ✅ Added `@clerk/nextjs` package

### 2. Environment Variables
- ✅ Removed `NEXTAUTH_SECRET` and `AUTH_SECRET`
- ✅ Added `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- ✅ Updated both `.env` and `.env.example` files

### 3. Middleware Configuration
- ✅ Replaced custom NextAuth middleware with `clerkMiddleware()`
- ✅ Updated middleware matcher configuration for optimal performance

### 4. App Layout
- ✅ Wrapped application with `<ClerkProvider>` in `app/layout.tsx`
- ✅ Removed `<SessionProvider>` references

### 5. Authentication Pages
- ✅ Replaced custom login page with Clerk's `<SignIn>` component
- ✅ Replaced custom register page with Clerk's `<SignUp>` component
- ✅ Removed custom registration API endpoint

### 6. Client Components
- ✅ Updated `ClientShell` to use Clerk's `useUser()` hook
- ✅ Added proper loading states and authentication checks
- ✅ Updated `Header` component with Clerk's `<UserButton>`
- ✅ Updated `Settings` page to use Clerk's user data and sign-out

### 7. API Routes
- ✅ Updated all API routes to use Clerk's `auth()` function
- ✅ Replaced session-based authentication with Clerk user ID
- ✅ Added user sync functionality for local database

### 8. Database Integration
- ✅ Modified user repository to work with Clerk user IDs
- ✅ Added `syncClerkUser()` function for automatic user creation
- ✅ Deprecated password-based authentication functions

### 9. SDK Updates
- ✅ Removed registration function from SDK (handled by Clerk)

### 10. Cleanup
- ✅ Removed all NextAuth configuration files
- ✅ Cleaned up all NextAuth imports and references
- ✅ Removed password hashing dependencies (handled by Clerk)

## 🔧 Required Setup

To complete the migration, you need to:

1. **Create a Clerk Application:**
   - Visit [https://dashboard.clerk.com/](https://dashboard.clerk.com/)
   - Create a new application
   - Copy your Publishable Key and Secret Key

2. **Update Environment Variables:**
   ```bash
   # Replace these placeholders in your .env file:
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key_here
   CLERK_SECRET_KEY=your_secret_key_here
   ```

3. **Database Migration (Optional):**
   - Existing user data will remain in your database
   - New users will be created automatically when they sign up through Clerk
   - User IDs will now be Clerk user IDs instead of UUIDs

## 🚀 Key Benefits

- **Simplified Authentication:** No more custom login/register forms or password management
- **Enhanced Security:** Clerk handles all security best practices
- **Better UX:** Professional authentication UI with social logins (configurable)
- **Reduced Code Complexity:** Less authentication-related code to maintain
- **Built-in Features:** User management, email verification, password reset, etc.

## 📝 Architecture Changes

### Before (NextAuth.js)
- Custom authentication with Prisma User table
- Password hashing with bcrypt
- Custom session management
- Manual user creation and verification

### After (Clerk)
- Clerk handles all authentication
- Automatic user sync to local database
- JWT-based sessions managed by Clerk
- Professional authentication UI

## 🔍 Testing Checklist

Before deploying to production, verify:

- [ ] Can sign up new users
- [ ] Can sign in existing users
- [ ] Protected routes require authentication
- [ ] User data syncs correctly to database
- [ ] API routes authenticate properly
- [ ] Sign out works correctly
- [ ] User profile displays correctly in settings

## 🛠️ Troubleshooting

### Common Issues:
1. **Missing Environment Variables:** Ensure both Clerk keys are set
2. **User Sync Issues:** Check API route logs for sync errors
3. **Redirect Issues:** Verify afterSignInUrl and afterSignOutUrl settings
4. **Database Errors:** Ensure Prisma schema supports Clerk user IDs

### Rollback Plan:
If issues occur, the git history contains all previous NextAuth.js configuration that can be restored.
