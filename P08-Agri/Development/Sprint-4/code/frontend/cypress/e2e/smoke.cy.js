/**
 * Public routes and navigation without calling the real API.
 */
describe('AgriQual smoke', () => {
  it('redirects / to /login', () => {
    cy.visit('/')
    cy.url().should('include', '/login')
  })

  it('shows the login page', () => {
    cy.visit('/login')
    cy.contains('Welcome back', { matchCase: false })
    cy.get('#email').should('be.visible')
    cy.get('#password').should('be.visible')
  })

  it('shows the register page', () => {
    cy.visit('/register')
    cy.contains('Create Account', { matchCase: false })
  })

  it('navigates from login to register via Sign up link', () => {
    cy.visit('/login')
    cy.contains('a', 'Sign up').click()
    cy.url().should('include', '/register')
  })
})
