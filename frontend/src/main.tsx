/**
 * Punto de entrada del frontend React.
 *
 * Monta `App` en el nodo `#root` e inicializa estilos globales.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
