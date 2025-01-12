const express = require('express')
const getBaseDateString = require('../utils/getBaseDateString')
const { settings, nonce, notification } = require('../../config')
const { getUserSelectedCourts, updateSelectedCourts } = require('../services/user-preference-service')
const { getCaseList, getCase, getMatchDetails, updateCase } = require('../services/case-service')
const {
  getDetails,
  getProbationRecord,
  getProbationRecordWithRequirements,
  getConvictionWithRequirements,
  getProbationStatusDetails,
  getSentenceDetails,
  getBreachDetails,
  getRiskDetails
} = require('../services/community-service')

const { health } = require('./middleware/healthcheck')
const { defaults } = require('./middleware/defaults')

module.exports = function Index ({ authenticationMiddleware }) {
  const router = express.Router()
  router.use(authenticationMiddleware())
  router.use(health)

  router.use((req, res, next) => {
    const { path, url } = req
    if (path.substr(-1) === '/' && path.length > 1) {
      const query = url.slice(path.length)
      res.redirect(301, path.slice(0, -1) + query)
    } else {
      next()
    }
  })

  router.get('/', (req, res) => {
    const { cookies } = req
    // @FIXME: Cookie check and removal to be removed at a later date
    if (cookies && cookies.court) {
      res.clearCookie('court')
    }
    res.redirect(302, cookies && cookies.currentCourt ? `/${cookies.currentCourt}/cases` : '/my-courts/setup')
  })

  router.get('/user-guide', (req, res) => {
    res.render('user-guide', { params: { nonce: nonce } })
  })

  router.get('/accessibility-statement', (req, res) => {
    res.render('accessibility-statement', { params: { nonce: nonce } })
  })

  router.get('/my-courts', async (req, res) => {
    const { session } = req
    const userSelectedCourts = await getUserSelectedCourts(res.locals.user.userId)
    session.courts = userSelectedCourts.items
    res.render('view-courts', {
      params: {
        availableCourts: settings.availableCourts,
        chosenCourts: session.courts,
        nonce: nonce
      }
    })
  })

  router.get('/my-courts/:state', async (req, res) => {
    const { params: { state }, query: { error, remove, save }, session } = req
    let formError = error
    let serverError = false
    if (save) {
      if (session.courts && session.courts.length) {
        const updatedCourts = await updateSelectedCourts(res.locals.user.userId, session.courts)
        if (updatedCourts.status >= 400) {
          serverError = true
        } else {
          return res.redirect(302, '/my-courts')
        }
      } else {
        formError = true
      }
    }
    if (remove && session.courts && session.courts.includes(remove)) {
      session.courts.splice(session.courts.indexOf(remove), 1)
      return res.redirect(req.path)
    }
    res.render('edit-courts', {
      formError: formError,
      serverError: serverError,
      state: state,
      params: {
        availableCourts: settings.availableCourts,
        chosenCourts: session.courts,
        nonce: nonce
      }
    })
  })

  router.post('/my-courts/:state', (req, res) => {
    const { params: { state }, session, body: { court } } = req
    if (!court) {
      return res.redirect(302, `/my-courts/${state}?error=true`)
    }
    session.courts = session.courts || []
    if (court && !session.courts.includes(court)) {
      session.courts.push(court)
    }
    res.redirect(req.path)
  })

  router.get('/select-court/:courtCode', (req, res) => {
    const { params: { courtCode } } = req

    res.status(201)
      .cookie('currentCourt', courtCode)
      .redirect(302, `/${courtCode}/cases/${getBaseDateString()}`)
  })

  router.get('/:courtCode/cases', (req, res) => {
    const { params: { courtCode }, session } = req
    res.redirect(302, `/${courtCode}/cases/${getBaseDateString()}${session.currentView ? '/' + session.currentView : ''}`)
  })

  router.get('/:courtCode/cases/:date/:subsection?', defaults, async (req, res) => {
    const { params: { courtCode, date, limit, subsection }, query: { page }, session, path, params } = req
    const response = await getCaseList(courtCode, date, session.selectedFilters, subsection)
    const caseCount = response.cases.length
    const startCount = ((parseInt(page, 10) - 1) || 0) * limit
    const endCount = Math.min(startCount + parseInt(limit, 10), caseCount)
    const templateValues = {
      title: 'Cases',
      params: {
        ...params,
        notification: notification || '',
        filters: response.filters,
        page: parseInt(page, 10) || 1,
        from: startCount,
        to: endCount,
        totalCount: response.totalCount,
        caseCount: caseCount,
        addedCount: response.addedCount,
        removedCount: response.removedCount,
        unmatchedRecords: response.unmatchedRecords,
        lastUpdated: response ? response.lastUpdated : '',
        totalDays: settings.casesTotalDays,
        subsection: subsection || '',
        filtersApplied: session.selectedFilters && Object.keys(session.selectedFilters).length,
        snapshot: response.snapshot
      },
      data: response.cases.slice(startCount, endCount) || []
    }
    session.currentView = subsection
    session.caseListDate = date
    session.currentCaseListViewLink = `${path}?page=${templateValues.params.page}`
    session.backLink = session.currentCaseListViewLink
    res.render('case-list', templateValues)
  })

  router.post('/:courtCode/cases/:date/:subsection?', defaults, async (req, res) => {
    const { params: { courtCode, date, subsection }, session, body } = req
    session.selectedFilters = body
    res.redirect(302, `/${courtCode}/cases/${date}${subsection ? '/' + subsection : ''}`)
  })

  router.post('/:courtCode/case/:caseNo/record', async (req, res) => {
    const { params: { courtCode, caseNo }, session } = req
    session.showAllPreviousOrders = caseNo
    res.redirect(302, `/${courtCode}/case/${caseNo}/record#previousOrders`)
  })

  async function getCaseAndTemplateValues (req) {
    const { params: { courtCode, caseNo }, session, params } = req
    const response = await getCase(courtCode, caseNo)
    const caseListDate = session.caseListDate || getBaseDateString()
    return {
      currentCaseListViewLink: session.currentCaseListViewLink,
      backLink: session.backLink,
      caseListDate,
      params: {
        ...params
      },
      data: {
        ...response
      }
    }
  }

  router.get('/:courtCode/case/:caseNo/summary', defaults, async (req, res) => {
    const { session, path } = req
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Case summary'
    templateValues.session = {
      ...session
    }
    session.confirmedMatch = undefined
    session.matchName = undefined
    session.matchType = 'defendant'
    session.matchDate = undefined
    session.backLink = path
    res.render('case-summary', templateValues)
  })

  router.get('/:courtCode/case/:caseNo/record', defaults, async (req, res) => {
    const { session } = req
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Probation record'

    const crn = templateValues.data.crn
    const communityResponse = await getProbationRecordWithRequirements(crn, true)
    templateValues.params.showAllPreviousOrders = session.showAllPreviousOrders
    templateValues.data.communityData = {
      ...communityResponse
    }
    res.render('case-summary-record', templateValues)
  })

  router.get('/:courtCode/case/:caseNo/record/:convictionId?', defaults, async (req, res) => {
    const { params: { convictionId } } = req
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Order details'

    const { data: { crn } } = templateValues
    let communityResponse = await getConvictionWithRequirements(crn, convictionId)

    if (communityResponse) {
      const { active, sentence } = communityResponse
      if (active) {
        const sentenceDetails = await getSentenceDetails(crn, convictionId, sentence.sentenceId)
        communityResponse = {
          ...communityResponse,
          sentenceDetails
        }
      }
    }

    templateValues.data.communityData = communityResponse || {}
    res.render('case-summary-record-order', templateValues)
  })

  router.get('/:courtCode/case/:caseNo/record/:convictionId/breach/:breachId', defaults, async (req, res) => {
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Breach details'

    const { params: { convictionId, breachId } } = req
    const { data: { crn } } = templateValues
    const communityResponse = await getProbationRecord(crn)

    const breachData = communityResponse.convictions
      .find(conviction => conviction.convictionId.toString() === convictionId.toString())
      .breaches.find(breach => breach.breachId.toString() === breachId.toString())

    const breachDetails = await getBreachDetails(crn, convictionId, breachId)
    templateValues.data.communityData = {
      ...breachData,
      ...breachDetails
    }
    res.render('case-summary-record-order-breach', templateValues)
  })

  router.get('/:courtCode/case/:caseNo/record/:convictionId/licence-details', defaults, async (req, res) => {
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Licence conditions details'

    const { data: { crn } } = templateValues
    const communityResponse = await getProbationRecordWithRequirements(crn)

    templateValues.data.communityData = communityResponse || {}
    res.render('case-summary-record-order-licence', templateValues)
  })

  router.get('/:courtCode/case/:caseNo/risk', defaults, async (req, res) => {
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Risk register'

    const { data: { crn } } = templateValues

    templateValues.data.riskData = await getRiskDetails(crn)

    templateValues.params = {
      ...templateValues.params
    }

    res.render('case-summary-risk', templateValues)
  })

  router.get('/:courtCode/match/bulk/:date', defaults, async (req, res) => {
    const { params: { courtCode, date }, session, params } = req
    const response = await getCaseList(courtCode, date)
    const templateValues = {
      title: 'Defendants with possible NDelius records',
      session: {
        ...session
      },
      params: {
        ...params
      },
      data: response.cases
    }
    session.confirmedMatch = undefined
    session.matchName = undefined
    session.matchType = 'bulk'
    session.matchDate = date
    res.render('match-records', templateValues)
  })

  router.get('/:courtCode/match/defendant/:caseNo', defaults, async (req, res) => {
    const { params: { courtCode, caseNo }, session, path } = req
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Review possible NDelius records'
    const response = await getMatchDetails(courtCode, caseNo)
    templateValues.session = {
      ...session
    }
    templateValues.data = {
      ...templateValues.data,
      matchData: response && response.offenderMatchDetails
    }
    session.confirmedMatch = undefined
    session.matchName = templateValues.data.defendantName
    session.formError = false
    session.serverError = false
    session.backLink = path
    res.render('match-defendant', templateValues)
  })

  async function updateCaseDetails (courtCode, caseNo, crn) {
    const caseResponse = await getCase(courtCode, caseNo)
    let offenderDetail
    let probationStatusDetails
    if (crn) {
      offenderDetail = await getDetails(crn)
      probationStatusDetails = await getProbationStatusDetails(crn)
    }
    return await updateCase(courtCode, caseNo, {
      ...caseResponse,
      pnc: crn ? offenderDetail.otherIds.pncNumber : caseResponse.pnc,
      crn: crn ? offenderDetail.otherIds.crn : null,
      cro: crn ? offenderDetail.otherIds.croNumber : null,
      probationStatus: crn ? probationStatusDetails.status : null,
      breach: crn ? probationStatusDetails.inBreach : null,
      preSentenceActivity: crn ? probationStatusDetails.preSentenceActivity : null
    })
  }

  function getMatchedUrl ($matchType, $matchDate, $caseNo) {
    return $matchType === 'bulk' ? '/match/bulk/' + $matchDate : '/case/' + $caseNo + '/summary'
  }

  router.post('/:courtCode/match/defendant/:caseNo', defaults, async (req, res) => {
    const { params: { courtCode, caseNo }, body: { crn }, session } = req
    let redirectUrl = '/'
    if (!crn) {
      session.confirmedMatch = undefined
      session.formError = true
      redirectUrl = `/${courtCode}/match/defendant/${caseNo}`
    } else {
      const response = await updateCaseDetails(courtCode, caseNo, crn)
      if (response.status === 201) {
        session.confirmedMatch = {
          name: session.matchName,
          matchType: 'Known'
        }
        redirectUrl = `/${courtCode}${getMatchedUrl(session.matchType, session.matchDate, caseNo)}`
      } else {
        session.serverError = true
        redirectUrl = `/${courtCode}/match/defendant/${caseNo}`
      }
    }
    res.redirect(302, redirectUrl)
  })

  router.get('/:courtCode/match/defendant/:caseNo/nomatch/:unlink?', defaults, async (req, res) => {
    const { params: { courtCode, caseNo, unlink }, session } = req
    let redirectUrl = '/'
    const response = await updateCaseDetails(courtCode, caseNo, undefined)
    if (response.status === 201) {
      session.confirmedMatch = {
        name: session.matchName,
        matchType: unlink ? 'unlinked' : 'No record'
      }
      redirectUrl = `/${courtCode}${getMatchedUrl(session.matchType, session.matchDate, caseNo)}`
    } else {
      req.session.serverError = true
      redirectUrl = `/${courtCode}/match/defendant/${caseNo}`
    }
    res.redirect(302, redirectUrl)
  })

  router.get('/:courtCode/match/defendant/:caseNo/manual', defaults, async (req, res) => {
    const { session } = req
    const templateValues = await getCaseAndTemplateValues(req)
    templateValues.title = 'Link an NDelius record to the defendant'
    templateValues.session = {
      ...session
    }
    templateValues.data = {
      ...templateValues.data
    }

    templateValues.data.manualMatch = true

    res.render('match-manual', templateValues)
  })

  router.post('/:courtCode/match/defendant/:caseNo/manual', defaults, async (req, res) => {
    const { params: { courtCode, caseNo }, body: { crn }, session } = req
    let redirectUrl = '/'
    session.serverError = false
    session.formError = false
    session.formInvalid = false
    session.crnInvalid = false
    session.confirmedMatch = undefined
    session.matchName = undefined
    if (!crn) {
      session.formError = true
      redirectUrl = `/${courtCode}/match/defendant/${caseNo}/manual`
    } else if (!req.body.crn.match(/[A-Za-z][0-9]{6}/)) {
      session.formError = true
      session.formInvalid = true
      redirectUrl = `/${courtCode}/match/defendant/${caseNo}/manual`
    } else {
      const detailResponse = await getDetails(crn)
      if (detailResponse.status >= 400) {
        session.crn = req.body.crn
        session.formError = true
        session.crnInvalid = true
        redirectUrl = `/${courtCode}/match/defendant/${caseNo}/manual`
      } else {
        redirectUrl = `/${courtCode}/match/defendant/${caseNo}/confirm/${crn}`
      }
    }
    res.redirect(302, redirectUrl)
  })

  router.get('/:courtCode/match/defendant/:caseNo/confirm/:crn', defaults, async (req, res) => {
    const { params: { crn }, session } = req
    const templateValues = await getCaseAndTemplateValues(req)
    const detailResponse = await getDetails(crn)
    const probationStatusDetails = await getProbationStatusDetails(crn)
    templateValues.title = 'Link an NDelius record to the defendant'
    templateValues.details = {
      ...detailResponse,
      probationStatus: probationStatusDetails.status
    }
    templateValues.session = {
      ...session
    }
    session.matchName = templateValues.data.defendantName
    res.render('match-manual', templateValues)
  })

  router.post('/:courtCode/match/defendant/:caseNo/confirm', defaults, async (req, res) => {
    const { params: { courtCode, caseNo }, body: { crn }, session } = req
    session.serverError = false
    let redirectUrl = '/'
    const response = await updateCaseDetails(courtCode, caseNo, crn)
    if (response.status === 201) {
      session.confirmedMatch = {
        name: session.matchName,
        matchType: 'linked',
        probationStatus: response.data.probationStatus
      }
      redirectUrl = `/${courtCode}${getMatchedUrl(session.matchType, session.matchDate, caseNo)}`
    } else {
      session.serverError = true
      redirectUrl = `/${courtCode}/match/defendant/${caseNo}/confirm`
    }
    res.redirect(302, redirectUrl)
  })

  router.get('/:courtCode/match/defendant/:caseNo/unlink/:crn', defaults, async (req, res) => {
    const { params: { courtCode, caseNo, crn }, session } = req
    const templateValues = await getCaseAndTemplateValues(req)
    const detailResponse = await getDetails(crn)
    templateValues.title = 'Unlink NDelius record from the defendant'
    templateValues.hideSubnav = true
    templateValues.backText = 'Back'
    templateValues.backLink = `/${courtCode}/case/${caseNo}/summary`
    templateValues.hideUnlinkButton = true
    templateValues.params = {
      ...templateValues.params
    }
    templateValues.details = {
      ...detailResponse
    }
    session.matchName = templateValues.data.defendantName
    res.render('match-unlink', templateValues)
  })

  return router
}
