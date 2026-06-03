import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPortalRoute = createRouteMatcher(["/portal(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // Humans accessing the portal must be signed in.
  // The /v1/* API is not session-based — it authenticates with bearer
  // tokens validated inside each route handler.
  if (isPortalRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Run on every page except static assets and Next internals.
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
