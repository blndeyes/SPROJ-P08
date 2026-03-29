const { defineConfig } = require('cypress')

/**
 * Cypress E2E against CRA dev server (port 3000). Run: npm run cypress:open | cypress:run | test:e2e:ci.
 */
module.exports = defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.js',
    specPattern: 'cypress/e2e/**/*.cy.js',
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    setupNodeEvents() {}
  }
})
