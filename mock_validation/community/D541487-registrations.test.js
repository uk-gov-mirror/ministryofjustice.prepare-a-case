/* global beforeAll, describe, it */
const { getValidator } = require('../utils/validator')
const { testGeneralValidation } = require('../common')

const mapping = require('../../mappings/community/D541487-registrations.json')

describe('Validate registrations mock with CRN D541487', () => {
  let validator

  beforeAll(async () => {
    validator = await getValidator()
  })

  it('should validate against the swagger doc', () => {
    testGeneralValidation(validator, mapping)
  })
})