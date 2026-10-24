import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';
import { verifierEvenementIntegration } from './src/integrations/verifier-evenement';

export default defineConfig({
  output: 'server',
  adapter: process.env.DEPLOY_TARGET === 'vercel' ? vercel() : node({ mode: 'standalone' }),
  server: { port: 4321 },
  integrations: [verifierEvenementIntegration()],
});
