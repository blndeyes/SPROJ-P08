/**
 * Each role lands on the correct dashboard after mocked login.
 */
describe('Role dashboards (mocked login)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800)
  })

  it('redirects farmer to farmer dashboard', () => {
    cy.loginWithMock('farmer')
    cy.url().should('include', '/farmer-dashboard')
    cy.contains('Test Farmer')
  })

  it('redirects inspector to inspector dashboard', () => {
    cy.loginWithMock('inspector')
    cy.url().should('include', '/inspector-dashboard')
    cy.contains('Test Inspector')
  })

  it('redirects admin to admin dashboard', () => {
    cy.loginWithMock('admin')
    cy.url().should('include', '/admin-dashboard')
    cy.contains('Admin Dashboard')
  })
})
