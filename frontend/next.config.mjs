/** @type {import('next').NextConfig} */
const isGitHubPages = process.env.GITHUB_PAGES === 'true' || process.env.NEXT_PUBLIC_IS_GH_PAGES === 'true';

const nextConfig = {
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  ...(isGitHubPages
    ? {
        output: 'export',
        basePath: process.env.NEXT_PUBLIC_BASE_PATH !== undefined ? process.env.NEXT_PUBLIC_BASE_PATH : '/NeuroSurgicalPlanner-SurgeryDemo',
        assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH !== undefined ? process.env.NEXT_PUBLIC_BASE_PATH : '/NeuroSurgicalPlanner-SurgeryDemo',
        images: { unoptimized: true },
      }
    : {
        async rewrites() {
          let backendUrl = process.env.BACKEND_URL || 'http://127.0.0.1:8000';
          if (!backendUrl.startsWith('http://') && !backendUrl.startsWith('https://')) {
            backendUrl = `http://${backendUrl}`;
          }
          return [
            {
              source: '/assets/:path*',
              destination: `${backendUrl}/assets/:path*`,
            },
            {
              source: '/api/:path*',
              destination: `${backendUrl}/api/:path*`,
            },
          ];
        },
      }),
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

export default nextConfig;
