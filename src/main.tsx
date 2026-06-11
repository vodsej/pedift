import { render } from 'preact'
import './ui/theme.css'
import './ui/styles/components.css'
import './ui/styles/app.css'
import { App } from './ui/App'

const root = document.getElementById('app')
if (root) render(<App />, root)
