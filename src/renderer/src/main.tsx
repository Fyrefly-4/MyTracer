import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { recordNoteCss } from '../../presentation/record-note'
import { App } from './App'
import './styles.css'
import './design-system.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Renderer root element is missing.')
}

createRoot(rootElement).render(
  <StrictMode>
    <style>{recordNoteCss}</style>
    <App />
  </StrictMode>
)
