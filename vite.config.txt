import { defineConfig } from 'vite';

export default defineConfig({
  // Set the root directory to 'public' where index.html is now located.
  root: 'public',
  build: {
    // Output the build to a 'dist' folder at the project's top level
    // (one level up from the new 'public' root).
    outDir: '../dist',
    emptyOutDir: true, // Recommended to clean the dist folder before build
  }
});