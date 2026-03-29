/**
 * Happy-path login with cy.loginWithMock('farmer').
 */
describe('Login (mocked API)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800)
  })

  it('logs in as farmer and lands on farmer dashboard', () => {
    cy.loginWithMock('farmer')
    cy.url().should('include', '/farmer-dashboard')
    cy.contains('Test Farmer', { matchCase: false })
  })
})
