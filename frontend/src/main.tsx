/**
 * Ponto de Entrada do Frontend (main.tsx)
 * Descrição: Inicializa a aplicação React no DOM, montando o componente raiz App
 * e aplicando os estilos globais no elemento container (#root).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
