/**
 * Configuração do Vite (vite.config.ts)
 * Descrição: Define as configurações do bundler e servidor de desenvolvimento do Vite,
 * incluindo plugins do React e compilador Babel.
 */
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
})
