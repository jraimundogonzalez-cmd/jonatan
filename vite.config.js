import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

const isSingleFile = process.env.SINGLE_FILE === '1'

export default defineConfig({
  plugins: isSingleFile ? [react(), viteSingleFile()] : [react()],
  base: isSingleFile ? "./" : "/jonatan/",
  build: isSingleFile ? {
    outDir: "dist-single",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  } : {},
})
