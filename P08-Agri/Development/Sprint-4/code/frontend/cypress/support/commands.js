/**
 * cy.loginWithMock(role) — stubs POST login and completes the form (farmer | inspector | admin).
 */
const MOCK_USERS = {
  farmer: {
    id: 'cypress-farmer',
    email: 'farmer@test.local',
    role: 'farmer',
    name: 'Test Farmer'
  },
  inspector: {
    id: 'cypress-inspector',
    email: 'inspector@test.local',
    role: 'inspector',
    name: 'Test Inspector'
  },
  admin: {
    id: 'cypress-admin',
    email: 'admin@test.local',
    role: 'admin',
    name: 'Test Admin'
  }
}

Cypress.Commands.add('loginWithMock', (role) => {
  const user = MOCK_USERS[role]
  if (!user) {
    throw new Error(`loginWithMock: unknown role "${role}"`)
  }

  cy.intercept('POST', '**/api/auth/login', {
    statusCode: 200,
    body: {
      token: 'cypress-mock-token',
      user
    }
  }).as('mockLogin')

  cy.visit('/login', {
    onBeforeLoad(win) {
      win.localStorage.clear()
    }
  })

  cy.get('#email').clear().type(user.email)
  cy.get('#password').clear().type('CypressTestPassword1!')
  cy.get('form').within(() => {
    cy.get('button[type="submit"]').click()
  })
  cy.wait('@mockLogin')
})
