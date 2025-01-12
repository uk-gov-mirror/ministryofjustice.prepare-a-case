const { request, requestFile } = require('./utils/request')
const config = require('../../config')
const apiUrl = config.apis.courtCaseService.url

const getRequirements = async (convictions, crn, activeOnly) => {
  return Promise.all(
    convictions.map(async conviction => {
      if (conviction.sentence && (!activeOnly || (activeOnly && conviction.active))) {
        const res = await request(`${apiUrl}/offender/${crn}/convictions/${conviction.convictionId}/requirements`)
        return { ...conviction, ...res.data }
      } else {
        return conviction
      }
    })
  )
}

const getRequirementsForSingleConviction = async (convictionId, crn) => {
  const res = await request(`${apiUrl}/offender/${crn}/convictions/${convictionId}/requirements`)
  return res.data
}

const getConviction = async (crn, convictionId) => {
  const res = await request(`${apiUrl}/offender/${crn}/convictions/${convictionId}`) || { data: {} }
  return res.data
}

const getProbationRecord = async crn => {
  const res = await request(`${apiUrl}/offender/${crn}/probation-record`) || { data: {} }
  return res.status >= 400 ? res : res.data
}

const getConvictionWithRequirements = async (crn, convictionId) => {
  const responseData = await getConviction(crn, convictionId)
  if (responseData) {
    const enrichedConviction = await getRequirementsForSingleConviction(convictionId, crn)
    return {
      ...responseData,
      conviction: enrichedConviction
    }
  }
  return responseData
}

const getProbationRecordWithRequirements = async (crn, activeOnly = false) => {
  const responseData = await getProbationRecord(crn)
  if (responseData && responseData.convictions) {
    const enrichedConvictions = await getRequirements(responseData.convictions, crn, activeOnly)
    return {
      ...responseData,
      convictions: enrichedConvictions
    }
  }
  return responseData
}

const getSentenceDetails = async (crn, convictionId, sentenceId) => {
  const res = await request(`${apiUrl}/offender/${crn}/convictions/${convictionId}/sentences/${sentenceId}`) || { data: {} }
  return res.data
}

const getBreachDetails = async (crn, convictionId, breachId) => {
  const res = await request(`${apiUrl}/offender/${crn}/convictions/${convictionId}/breaches/${breachId}`) || { data: {} }
  return res.data
}

const getAttachment = async (crn, documentId) => {
  return await requestFile(`${apiUrl}/offender/${crn}/documents/${documentId}`) || {}
}

const getDetails = async crn => {
  const res = await request(`${apiUrl}/offender/${crn}/detail`) || {}
  return res.status >= 400 ? res : res.data
}

const getProbationStatusDetails = async crn => {
  const res = await request(`${apiUrl}/offender/${crn}/probation-status-detail`) || {}
  return res.status >= 400 ? res : res.data
}

const getRiskDetails = async crn => {
  const res = await request(`${apiUrl}/offender/${crn}/registrations`) || { data: {} }
  return res.data
}

module.exports = {
  getDetails,
  getProbationRecord,
  getConvictionWithRequirements,
  getProbationRecordWithRequirements,
  getProbationStatusDetails,
  getSentenceDetails,
  getBreachDetails,
  getAttachment,
  getRiskDetails,
  getConviction,
  getRequirementsForSingleConviction
}
