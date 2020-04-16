/* global cy */
import moment from 'moment'
import 'cypress-axe'
import { And, Then, When } from 'cypress-cucumber-preprocessor/steps'
import { getMonthsAndDays } from '../../../../routes/middleware/defaults'
import World from '../../world/World'

const world = new World('caseSummary')

And('I am looking at a not known defendant', () => {
  world.scenario = 'notKnownDefendant'
})

And('I am looking at a previously known defendant', () => {
  world.scenario = 'previouslyKnownDefendant'
})

And('I am looking at a current defendant', () => {
  world.scenario = 'currentDefendant'
})

And('I am looking at a current defendant with breach', () => {
  world.scenario = 'currentDefendantWithBreach'
})

When('I navigate to the case details route', () => {
  cy.visit(`case/${world.data.caseNo}/details`)
})

When('I navigate to the probation record route', () => {
  cy.visit(`case/${world.data.caseNo}/record`)
})

When('I click the first {string} order link', $type => {
  cy.get('.govuk-link').contains($type === 'current' ? world.data.currentOrderTitle : world.data.previousOrderTitle).click()
})

Then('I should see the offender current order count', () => {
  cy.get('h2').contains(`Current orders (${world.data.currentOrderCount})`)
})

And('I should see link to the first current order', () => {
  cy.get('.govuk-link').contains(world.data.currentOrderTitle).should('exist')
    .should('have.attr', 'href')
    .and('include', `record/${world.data.currentOrderId}`)
})

And('I should see the current order offence', () => {
  cy.get('.govuk-body').contains(world.data.currentOrderOffence)
})

And('I should see the current order start date', () => {
  const startDate = moment(world.data.currentOrderStartDate).format('DD MMMM YYYY')
  cy.get('.govuk-hint').contains(`Started on ${startDate}`)
})

And('I should see the offender previous order count', () => {
  cy.get('h2').contains(`Previous orders (${world.data.previousOrderCount})`)
})

And('I should see link to the first previous order', ($string, $href) => {
  cy.get('.govuk-link').contains(world.data.previousOrderTitle).should('exist')
    .should('have.attr', 'href')
    .and('include', `record/${world.data.previousOrderId}`)
})

And('I should see the previous order offence', () => {
  cy.get('.govuk-hint').contains(world.data.previousOrderOffence)
})

And('I should see the offender manager details', () => {
  const offenderManager = world.data.offenderManager
  cy.get('.govuk-grid-column-one-third').within(() => {
    cy.get('.govuk-body').contains(offenderManager)
    if (offenderManager !== 'Not active') {
      cy.get('.govuk-hint').contains(`Allocated on ${world.data.offenderManagerDetails.allocated}`)
      cy.get('.govuk-body').contains(world.data.offenderManagerDetails.address1)
      cy.get('.govuk-body').contains(world.data.offenderManagerDetails.address2)
      cy.get('.govuk-body').contains(world.data.offenderManagerDetails.address3)
      cy.get('.govuk-body').contains(world.data.offenderManagerDetails.address4)
      cy.get('.govuk-body').contains(world.data.offenderManagerDetails.address5)
      cy.get('.govuk-body').contains(world.data.offenderManagerDetails.postcode)
      cy.get('.govuk-body').contains(`Telephone: ${world.data.offenderManagerDetails.telephone}`)
    }
  })
})

And('I should see the {string} summary table', ($position, $data) => {
  $data.raw().forEach((row, index) => {
    row.forEach((text, index2) => {
      cy.get(`${$position === 'first' ? '.govuk-table' : '.govuk-table ~ .govuk-table'} > .govuk-table__body > .govuk-table__row`).within(() => {
        cy.get(index2 % 2 === 0 ? '.govuk-table__header' : '.govuk-table__cell').eq(index).contains(text)
      })
    })
  })
})

Then('I should see a summary list', ($data) => {
  cy.get('.govuk-summary-list').should('exist')
})

Then('I click the defendant name link', () => {
  cy.get('.govuk-link').contains(world.data.name).click()
})

Then('I should see the heading has the defendant name', () => {
  cy.get('h1').contains(world.data.name)
})

And('I should see the body text {string} and the defendant {string}', ($label, $key) => {
  let dataPoint = world.data[$key]
  if ($key === 'dateOfBirth') {
    dataPoint = moment(world.data[$key], 'YYYY-MM-DD').format('Do MMMM YYYY')
  }
  cy.get('.govuk-body').contains(`${$label} ${dataPoint}`)
})

And('I should see the body text with the defendant {string} in bold', $key => {
  cy.get('.govuk-body').contains(world.data[$key]).should('exist').should('have.attr', 'class').and('include', 'govuk-!-font-weight-bold')
})

And('I should see the body text with the defendant {string}', $key => {
  cy.get('.govuk-body').contains(world.data[$key])
})

And('I should see the caption text with the defendant {string}', $key => {
  cy.get('.govuk-caption-m').contains(world.data[$key])
})

And('I should see the level 2 heading with the {string} order title', $type => {
  cy.get('h2').contains($type === 'current' ? world.data.currentOrderTitle : world.data.previousOrderTitle)
})

And('I should see the {string} order start and end dates', $type => {
  cy.get('.qa-start-date').contains(moment($type === 'current' ? world.data.currentOrderStartDate : world.data.previousOrderStartDate).format('DD MMMM YYYY'))
  cy.get('.qa-end-date').contains(moment($type === 'current' ? world.data.currentOrderEndDate : world.data.previousOrderEndDate).format('DD MMMM YYYY'))
})

And('I should see the correctly calculated elapsed time for the {string} order', $type => {
  const tmpEndDate = $type === 'current' ? world.data.currentOrderEndDate : world.data.previousOrderEndDate
  const startDate = moment($type === 'current' ? world.data.currentOrderStartDate : world.data.previousOrderStartDate, 'YYYY-MM-DD')
  const endDate = moment(tmpEndDate, 'YYYY-MM-DD').isAfter() ? moment() : moment(tmpEndDate, 'YYYY-MM-DD')
  cy.get('.qa-elapsed-time').contains(getMonthsAndDays(startDate, endDate))
})

And('I should see the row with the key {string}', $title => {
  cy.get('.govuk-summary-list__key').contains($title)
})

And('I should see the value with defendant {string}', $key => {
  let dataPoint = world.data[$key]
  if ($key === 'dateOfBirth') {
    const age = moment().diff(moment(world.data[$key], 'YYYY-MM-DD'), 'years')
    dataPoint = `${moment(world.data[$key], 'YYYY-MM-DD').format('D MMMM YYYY')} (${age} years old)`
  }
  cy.get('.govuk-summary-list__value').contains(dataPoint)
})

And('I should see a straight line divide', () => {
  cy.get('.pac-key-details-bar__divider').should('exist')
})

And('I should see court room, session and the correct listing', () => {
  const date = moment().format('dddd Do MMMM')
  cy.get('.govuk-body').contains(`Court ${world.data.court}, ${world.data.session} session, ${date} (${world.data.listing} listing).`)
})

And('I should see the appointment attendance information', () => {
  world.data.currentOrderAttendance.counts.forEach(($text, $index) => {
    cy.get('.app-dashboard-count').eq($index).contains($text)
  })
  world.data.currentOrderAttendance.headings.forEach($text => {
    cy.get('h3').contains($text)
  })
  world.data.currentOrderAttendance.types.forEach($text => {
    cy.get('.govuk-body').contains($text)
  })
})