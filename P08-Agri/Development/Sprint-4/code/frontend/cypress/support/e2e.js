/**
 * Runs before each spec: loads custom commands and ignores common axios noise after mocked navigations.
 */
import './commands'

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('Network Error') || err.message.includes('Request failed')) {
    return false
  }
  return undefined
})
