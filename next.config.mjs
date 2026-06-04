/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      // Legacy wait-list form → new onboarding flow.
      {
        source: "/developers/request-access",
        destination: "/get-started",
        permanent: true,
      },
      // Legacy staff inbox → new partners directory.
      {
        source: "/portal/access-requests",
        destination: "/portal/partners",
        permanent: true,
      },
      {
        source: "/portal/access-requests/:path*",
        destination: "/portal/partners",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
