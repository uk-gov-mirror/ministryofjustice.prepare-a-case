const moment = require('moment')
const config = require('../../config')

/**
 * @typedef {import('moment')} moment
 */
/**
 * Get the latest snapshot date and time
 * @param {string} caseListDate - Date string as 'YYYY-MM-DD'
 * @returns {moment}
 */
module.exports = caseListDate => {
  const now = moment()
  const requestedDate = moment(caseListDate)
  const snapshotTimes = config.settings.snapshotTimes.split(',')
  const baseFormat = 'YYYY-MM-DD'

  if (requestedDate.isBefore(now, 'day')) {
    return moment(`${requestedDate.format(baseFormat)} ${snapshotTimes.pop()}`)
  }

  let currentTestTime, latestSnapshot

  snapshotTimes.forEach(snapshotTime => {
    currentTestTime = moment(`${now.format(baseFormat)} ${snapshotTime}`)
    if (now.isSameOrAfter(currentTestTime, 'minute')) {
      latestSnapshot = currentTestTime
    }
  })

  return latestSnapshot
}
