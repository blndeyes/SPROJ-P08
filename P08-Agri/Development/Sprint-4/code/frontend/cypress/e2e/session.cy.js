/**
 * Profile menu logout returns to /login and clears the token (farmer and admin).
 */
describe('Session / logout', () => {
  beforeEach(() => {
    cy.viewport(1280, 800)
  })

  it('logs out from farmer dashboard and returns to login', () => {
    cy.loginWithMock('farmer')
    cy.url().should('include', '/farmer-dashboard')

    cy.contains('Test Farmer').click()
    cy.contains('button', 'Logout').click()

    cy.url().should('include', '/login')
    cy.window().then((win) => {
      expect(win.localStorage.getItem('token')).to.be.null
    })
  })

  it('logs out from admin dashboard and returns to login', () => {
    cy.loginWithMock('admin')
    cy.contains('Admin Dashboard')

    cy.contains('Test Admin').click()
    cy.contains('button', 'Logout').click()

    cy.url().should('include', '/login')
  })
})
