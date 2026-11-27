import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Builds the browser part into dist/client.js and dist/style.css. React and the Glassboard SDK
 * are left out: the dashboard shares its own with the plugin.
 */
export default defineConfig({
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [react()],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        cssCodeSplit: false,
        lib: {
            entry: 'src/index.jsx',
            formats: ['es'],
            fileName: () => 'client.js',
            cssFileName: 'style',
        },
        rollupOptions: {
            external: ['react', 'react/jsx-runtime', 'react-dom', '@glassboard/sdk'],
        },
    },
});
