/**
 * Login page EN ↔ Urdu toggle using visible copy.
 */
describe('Language toggle', () => {
  beforeEach(() => {
    cy.visit('/login', {
      onBeforeLoad(win) {
        win.localStorage.clear()
      }
    })
  })

  it('switches login page to Urdu when toggling language', () => {
    cy.contains('Welcome back')
    cy.get('button').contains('اردو').click()
    cy.contains('خوش آمدید')
  })

  it('switches back to English', () => {
    cy.get('button').contains('اردو').click()
    cy.contains('خوش آمدید')
    cy.get('button').contains('English').click()
    cy.contains('Welcome back')
  })
})
