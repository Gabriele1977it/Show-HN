// proxy.ts — Next.js 16 replaces middleware.ts with proxy.ts.
// Clerk's middleware runs here so every request knows who is logged in.

import { clerkMiddleware } from '@clerk/nextjs/server';

export default clerkMiddleware();

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
