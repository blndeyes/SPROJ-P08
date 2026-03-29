/**
 * Failed login responses show the right message in the UI (intercepted).
 */
describe('Login errors (mocked API)', () => {
  beforeEach(() => {
    cy.visit('/login', {
      onBeforeLoad(win) {
        win.localStorage.clear()
      }
    })
  })

  it('shows server error message on failed login', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: { message: 'Invalid email or password' }
    }).as('loginFail')

    cy.get('#email').type('wrong@example.com')
    cy.get('#password').type('wrongpass')
    cy.get('form').within(() => {
      cy.get('button[type="submit"]').click()
    })

    cy.wait('@loginFail')
    cy.contains('Invalid email or password')
  })

  it('shows generic message when API returns no message', () => {
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: {}
    }).as('loginFail')

    cy.get('#email').type('x@y.com')
    cy.get('#password').type('bad')
    cy.get('form').within(() => {
      cy.get('button[type="submit"]').click()
    })

    cy.wait('@loginFail')
    cy.contains('Login failed', { matchCase: false })
  })
})
