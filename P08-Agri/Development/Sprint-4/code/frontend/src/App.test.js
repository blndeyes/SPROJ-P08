/**
 * Smoke unit test: App redirects unauthenticated users toward login (axios mocked).
 */
import { render, screen } from '@testing-library/react'
import App from './App'

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: () => ({
      post: jest.fn(),
      get: jest.fn()
    })
  }
}))

test('renders login screen by default', () => {
  render(<App />)
  expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
})
