import { render } from 'preact'

function App() {
  return <h1>pedift — build pipeline OK</h1>
}

const root = document.getElementById('app')
if (root) render(<App />, root)
