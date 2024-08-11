import { defineConfig } from 'astro/config';
import tailwind from "@astrojs/tailwind";
import 'dotenv/config';
// https://astro.build/config
import react from "@astrojs/react";
import node from '@astrojs/node';

// https://astro.build/config

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind(), react()],
  output: "server",
  server: {
    port: 3000,
    host: true
  },
  adapter: node({
    mode: 'standalone'
  })
});