import { defineConfig } from 'astro/config';
import 'dotenv/config';
import react from "@astrojs/react";
import node from '@astrojs/node';

// https://astro.build/config

// https://astro.build/config
import auth from "auth-astro";

import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  output: "server",

  server: {
    port: 3000,
    host: true
  },

  adapter: node({
    mode: 'standalone'
  }),

  vite: {
    plugins: [tailwindcss()]
  }
});