import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/glass.css'
import './styles/liquid.css'
import './styles/material.css'
import './styles/neon.css'
import './styles/terminal.css'
import App from './App.jsx'
import { loadExternalPlugins, shareModules } from './plugins/external'

// Plugins from the plugins folder load next to the dashboard; their cards appear once they have
shareModules()
loadExternalPlugins()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
