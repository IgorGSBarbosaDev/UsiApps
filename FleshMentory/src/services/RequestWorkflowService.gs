var FLASH_MENTORING_REQUEST_STATUS = Object.freeze({
  RH_REVIEW: 'RH_REVIEW',
  INVITING_MENTOR: 'INVITING_MENTOR',
  MATCHED: 'MATCHED',
  IN_PROGRESS: 'IN_PROGRESS',
  TALENT_REVIEW: 'TALENT_REVIEW',
  REALIZED: 'REALIZED',
  CANCELLED: 'CANCELLED',
  NOT_REALIZED: 'NOT_REALIZED'
});

var FLASH_MENTORING_CANDIDATE_STATUS = Object.freeze({
  RECOMMENDED: 'RECOMMENDED',
  APPROVED: 'APPROVED',
  INVITED: 'INVITED',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  NOT_SELECTED: 'NOT_SELECTED',
  SUPERSEDED: 'SUPERSEDED',
  TALENT_REVIEW_PENDING: 'TALENT_REVIEW_PENDING',
  NEXT_MONTH_PENDING: 'AVAILABLE_NEXT_MONTH_PENDING',
  CAPACITY_UNAVAILABLE: 'CAPACITY_UNAVAILABLE'
});

var FLASH_MENTORING_MENTOR_STATUS = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  REJECTED: 'REJECTED'
});

var FLASH_MENTORING_TOPIC_CATALOG = Object.freeze([
  Object.freeze({ category: 'Carreira e Desenvolvimento', topicName: 'Reflexão sobre próximos passos de carreira' }),
  Object.freeze({ category: 'Carreira e Desenvolvimento', topicName: 'Transição entre áreas ou funções' }),
  Object.freeze({ category: 'Carreira e Desenvolvimento', topicName: 'Desenvolvimento de competências' }),
  Object.freeze({ category: 'Carreira e Desenvolvimento', topicName: 'Preparação para novos desafios profissionais' }),
  Object.freeze({ category: 'Liderança', topicName: 'Preparação para a primeira liderança' }),
  Object.freeze({ category: 'Liderança', topicName: 'Gestão de pessoas' }),
  Object.freeze({ category: 'Liderança', topicName: 'Influência sem autoridade formal' }),
  Object.freeze({ category: 'Liderança', topicName: 'Feedback e conversas difíceis' }),
  Object.freeze({ category: 'Desafios Profissionais', topicName: 'Tomada de decisão' }),
  Object.freeze({ category: 'Desafios Profissionais', topicName: 'Gestão de stakeholders' }),
  Object.freeze({ category: 'Desafios Profissionais', topicName: 'Atuação transversal' }),
  Object.freeze({ category: 'Desafios Profissionais', topicName: 'Comunicação e exposição' }),
  Object.freeze({ category: 'Desafios Profissionais', topicName: 'Adaptação a novos contextos' }),
  Object.freeze({ category: 'Experiências e Trajetórias', topicName: 'Experiência industrial' }),
  Object.freeze({ category: 'Experiências e Trajetórias', topicName: 'Experiência corporativa' }),
  Object.freeze({ category: 'Experiências e Trajetórias', topicName: 'Mobilidade entre áreas' }),
  Object.freeze({ category: 'Experiências e Trajetórias', topicName: 'Projetos estratégicos' }),
  Object.freeze({ category: 'Experiências e Trajetórias', topicName: 'Transformação ou mudança organizacional' })
]);

function getFlashMentoringAdminBootstrap_(principal) {
  principal = requireVerifiedFlashMentoringActor_(principal);
  assertFlashMentoringAdminReviewer_(principal);
  var repositories = getFlashMentoringRepositories_();
  var requests = filterFlashMentoringRequestsForAdmin_(principal, repositories.REQUESTS.listAll(), repositories);
  var counts = {};
  requests.forEach(function(request) {
    var status = String(request.status || 'TALENT_REVIEW');
    counts[status] = (counts[status] || 0) + 1;
  });
  return {
    statusOptions: getFlashMentoringRequestStatusCodes_().map(function(code) {
      return { code: code, label: getFlashMentoringStatusLabel_(code), count: counts[code] || 0 };
    }),
    mentors: listFlashMentoringMentorDtos_(repositories, 200)
  };
}

function listFlashMentoringRequestsForAdmin_(principal, filters) {
  principal = requireVerifiedFlashMentoringActor_(principal);
  assertFlashMentoringAdminReviewer_(principal);
  filters = filters || {};
  var repositories = getFlashMentoringRepositories_();
  var peopleById = makeFlashMentoringPersonMap_(repositories.PEOPLE_MASTER.listAll());
  var requests = filterFlashMentoringRequestsForAdmin_(
    principal,
    repositories.REQUESTS.listAll(),
    repositories
  );
  var statusFilter = String(filters.status || 'ALL').toUpperCase();
  var search = String(filters.search || '').trim().toLowerCase();
  var items = requests.filter(function(request) {
    if (statusFilter !== 'ALL' && String(request.status) !== statusFilter) return false;
    if (!search) return true;
    var mentee = peopleById[String(request.menteePersonId)] || {};
    return [request.requestId, request.topicCategory, request.topicName, request.status,
      mentee.displayName, mentee.jobTitle, mentee.area, mentee.unit]
      .some(function(value) { return String(value || '').toLowerCase().indexOf(search) >= 0; });
  }).sort(function(a, b) {
    return compareFlashMentoringDates_(b.submittedAt, a.submittedAt);
  });
  var page = normalizeFlashMentoringInteger_(filters.page, 1, 10000, 1);
  var pageSize = normalizeFlashMentoringInteger_(filters.pageSize, 10, 50, 20);
  var start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize).map(function(request) {
      var mentee = peopleById[String(request.menteePersonId)] || {};
      return {
        requestId: String(request.requestId),
        status: String(request.status || FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW),
        statusLabel: getFlashMentoringStatusLabel_(request.status),
        topicCategory: String(request.topicCategory || ''),
        topicName: String(request.topicName || ''),
        menteeName: String(mentee.displayName || ''),
        menteeJobTitle: String(mentee.jobTitle || ''),
        menteeArea: String(mentee.area || ''),
        menteeUnit: String(mentee.unit || ''),
        submittedAt: formatFlashMentoringDate_(request.submittedAt)
      };
    }),
    page: page,
    pageSize: pageSize,
    total: items.length
  };
}

function getFlashMentoringRequestForAdmin_(principal, requestId) {
  principal = requireVerifiedFlashMentoringActor_(principal);
  assertFlashMentoringAdminReviewer_(principal);
  var repositories = getFlashMentoringRepositories_();
  var request = findFlashMentoringRequest_(repositories, requestId);
  if (!request) throw createFlashMentoringServiceError_('NOT_FOUND');
  assertFlashMentoringRequestReviewer_(principal, request, repositories);

  var peopleById = makeFlashMentoringPersonMap_(repositories.PEOPLE_MASTER.listAll());
  var mentee = peopleById[String(request.menteePersonId)] || {};
  var manager = peopleById[String(mentee.immediateManagerPersonId || '')] || {};
  var candidates = listCurrentFlashMentoringCandidates_(repositories, request)
    .sort(function(a, b) { return Number(a.candidateOrder) - Number(b.candidateOrder); })
    .map(function(candidate) {
      var mentorPerson = peopleById[String(candidate.mentorPersonId)] || {};
      var capacity = null;
      try {
        capacity = getFlashMentoringCapacitySnapshot_(repositories, candidate.mentorPersonId);
      } catch (error) {
        queueFlashMentoringTalentReview_('REQUESTS', request.requestId, 'MENTOR_CAPACITY_DATA_UNAVAILABLE');
      }
      return {
        candidateId: String(candidate.candidateId),
        order: Number(candidate.candidateOrder),
        displayName: String(mentorPerson.displayName || ''),
        jobTitle: String(mentorPerson.jobTitle || ''),
        area: String(mentorPerson.area || ''),
        unit: String(mentorPerson.unit || ''),
        cluster: String(mentorPerson.cluster || ''),
        availableSlots: capacity ? capacity.availableCount : null,
        rationale: String(candidate.rationale || '')
      };
    });

  return {
    requestId: String(request.requestId),
    status: String(request.status || ''),
    statusLabel: getFlashMentoringStatusLabel_(request.status),
    topicCategory: String(request.topicCategory || ''),
    topicName: String(request.topicName || ''),
    challengeSummary: String(request.challengeSummary || ''),
    desiredOutcome: String(request.desiredOutcome || ''),
    submittedAt: formatFlashMentoringDate_(request.submittedAt),
    mentee: {
      displayName: String(mentee.displayName || ''),
      jobTitle: String(mentee.jobTitle || ''),
      area: String(mentee.area || ''),
      unit: String(mentee.unit || ''),
      audience: String(mentee.wcBc || ''),
      managerDisplayName: String(manager.displayName || '')
    },
    candidates: candidates
  };
}

function getFlashMentoringPortalBootstrap_(actor) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  var repositories = getFlashMentoringRepositories_();
  var mentor = repositories.MENTORS.listAll().filter(function(record) {
    return String(record.personId) === String(actor.personId);
  })[0] || null;
  var pulseScale = getFlashMentoringRecommendationScale_(repositories);
  var policy = getFlashMentoringFollowUpPolicy_(repositories);
  var roleSet = actor.roles || [];
  return {
    viewer: {
      displayName: String(actor.displayName || ''),
      jobTitle: String(actor.person && actor.person.jobTitle || ''),
      area: String(actor.person && actor.person.area || ''),
      unit: String(actor.person && actor.person.unit || ''),
      wcBc: String(actor.person && actor.person.wcBc || ''),
      cluster: String(actor.person && actor.person.cluster || ''),
      roles: roleSet.slice()
    },
    capabilities: {
      canManageMentorProfile: true,
      canSubmitRequest: roleSet.indexOf('MENTORADO') >= 0,
      canViewMyRequests: roleSet.indexOf('MENTORADO') >= 0,
      canViewInvites: roleSet.indexOf('MENTOR') >= 0,
      canViewMatches: roleSet.indexOf('MENTORADO') >= 0 || roleSet.indexOf('MENTOR') >= 0
    },
    topicCatalog: getFlashMentoringTopicCatalog_(),
    mentorProfile: mentor ? {
      hasProfile: true,
      status: String(mentor.status || ''),
      statusLabel: getFlashMentoringStatusLabel_(mentor.status),
      topics: listFlashMentoringTopicsForPerson_(repositories, actor.personId),
      experienceSummary: String(mentor.experienceSummary || ''),
      capacityLimit: mentor.capacityLimit == null ? '' : String(mentor.capacityLimit)
    } : { hasProfile: false, status: '', statusLabel: '', topics: [], experienceSummary: '', capacityLimit: '' },
    pulseRecommendationOptions: pulseScale.configured ? pulseScale.values.slice() : [],
    configurationPending: {
      pulseRecommendationScale: pulseScale.pending,
      followUpCadence: policy.pendingConfiguration,
      availableNextMonthRule: true,
      mentorSenioritySource: true
    }
  };
}

function getFlashMentoringMyRequests_(actor) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  var repositories = getFlashMentoringRepositories_();
  var requests = repositories.REQUESTS.listAll();
  var requestsById = Object.create(null);
  requests.forEach(function(request) { requestsById[String(request.requestId)] = request; });
  var candidates = repositories.REQUEST_CANDIDATES.listAll();
  var matches = repositories.MATCHES.listAll();
  var pulsesByMatchId = Object.create(null);
  repositories.PULSE.listAll().forEach(function(pulse) {
    pulsesByMatchId[String(pulse.matchId)] = true;
  });
  var menteeRequests = [];
  if (hasFlashMentoringRole_(actor, 'MENTORADO')) {
    menteeRequests = requests.filter(function(request) {
      return String(request.menteePersonId) === String(actor.personId);
    }).map(function(request) {
      return {
        requestId: String(request.requestId),
        status: String(request.status || ''),
        statusLabel: getFlashMentoringStatusLabel_(request.status),
        pending: String(request.status) === FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW,
        topicCategory: String(request.topicCategory || ''),
        topicName: String(request.topicName || ''),
        challengeSummary: String(request.challengeSummary || ''),
        desiredOutcome: String(request.desiredOutcome || '')
      };
    });
  }

  var mentorInvites = [];
  if (hasFlashMentoringRole_(actor, 'MENTOR')) {
    mentorInvites = candidates.filter(function(candidate) {
      return String(candidate.mentorPersonId) === String(actor.personId)
        && [FLASH_MENTORING_CANDIDATE_STATUS.INVITED, FLASH_MENTORING_CANDIDATE_STATUS.NEXT_MONTH_PENDING]
          .indexOf(String(candidate.status)) >= 0;
    }).map(function(candidate) {
      var request = requestsById[String(candidate.requestId)] || {};
      return {
        candidateId: String(candidate.candidateId),
        status: String(candidate.status || ''),
        statusLabel: candidate.status === FLASH_MENTORING_CANDIDATE_STATUS.NEXT_MONTH_PENDING
          ? 'Pendente para análise de Talent'
          : 'Convite recebido',
        pending: candidate.status === FLASH_MENTORING_CANDIDATE_STATUS.NEXT_MONTH_PENDING,
        nextMonthPending: candidate.status === FLASH_MENTORING_CANDIDATE_STATUS.NEXT_MONTH_PENDING,
        canRespond: candidate.status === FLASH_MENTORING_CANDIDATE_STATUS.INVITED,
        topicCategory: String(request.topicCategory || ''),
        topicName: String(request.topicName || '')
      };
    });
  }

  var actorMatches = matches.filter(function(match) {
    return String(match.menteePersonId) === String(actor.personId)
      || String(match.mentorPersonId) === String(actor.personId);
  }).map(function(match) {
    var request = requestsById[String(match.requestId)] || {};
    var isMentee = String(match.menteePersonId) === String(actor.personId);
    var hasPulse = !!pulsesByMatchId[String(match.matchId)];
    return {
      matchId: String(match.matchId),
      status: String(match.status || ''),
      statusLabel: getFlashMentoringStatusLabel_(match.status),
      topicCategory: String(request.topicCategory || ''),
      topicName: String(request.topicName || ''),
      summary: String(request.challengeSummary || ''),
      scheduledAt: formatFlashMentoringDate_(match.scheduledAt),
      canUpdateProgress: isMentee && isFlashMentoringMatchActive_(String(match.status)),
      canSubmitPulse: isMentee && String(match.status) === FLASH_MENTORING_MATCH_STATUSES.REALIZED && !hasPulse
    };
  });
  return { menteeRequests: menteeRequests, mentorInvites: mentorInvites, matches: actorMatches };
}

function submitFlashMentoringMentorProfile_(actor, payload) {
  return saveFlashMentoringMentorProfile_(actor, payload, false);
}

function updateFlashMentoringMentorProfile_(actor, payload) {
  return saveFlashMentoringMentorProfile_(actor, payload, true);
}

function saveFlashMentoringMentorProfile_(actor, payload, isUpdate) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  payload = payload || {};
  if (payload.principlesAcknowledged !== true) {
    throw createFlashMentoringServiceError_('MENTOR_PRINCIPLES_ACKNOWLEDGEMENT_REQUIRED');
  }
  var topics = validateFlashMentoringTopics_(payload.topics, 5, 1);
  var capacityLimit = normalizeFlashMentoringInteger_(payload.capacityLimit, 1, 2, null);
  if (capacityLimit == null) throw createFlashMentoringServiceError_('MENTOR_CAPACITY_INVALID');
  var experienceSummary = normalizeFlashMentoringRequestText_(payload.experienceSummary, 3000, false);
  var repositories = getFlashMentoringRepositories_();
  var now = new Date().toISOString();
  var existing = repositories.MENTORS.listAll().filter(function(record) {
    return String(record.personId) === String(actor.personId);
  })[0];
  if (isUpdate && !existing) throw createFlashMentoringServiceError_('MENTOR_PROFILE_NOT_FOUND');
  var storedStatus = FLASH_MENTORING_MENTOR_STATUS.PENDING_REVIEW;
  var mentorRecord = {
    personId: String(actor.personId),
    status: storedStatus,
    capacityLimit: capacityLimit,
    experienceSummary: experienceSummary,
    curatedByPersonId: '',
    curatedAt: '',
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now
  };
  repositories.MENTORS.upsertMany([mentorRecord]);
  upsertFlashMentoringTopicSlots_(repositories, actor.personId, topics, now);
  if (existing && String(existing.status) === FLASH_MENTORING_MENTOR_STATUS.ACTIVE) {
    setFlashMentoringRoleAssignment_(repositories, actor.personId, 'MENTOR', false, actor.personId, now);
  }
  queueFlashMentoringTalentReview_('MENTORS', actor.personId, 'MENTOR_PROFILE_REVIEW_REQUIRED');
  recordFlashMentoringAudit_(actor.personId, isUpdate ? 'MENTOR_PROFILE_UPDATED' : 'MENTOR_PROFILE_SUBMITTED',
    'MENTORS', actor.personId, { nextStatus: storedStatus, candidateCount: topics.length });
  return {
    mentorPersonId: String(actor.personId),
    status: storedStatus,
    statusLabel: getFlashMentoringStatusLabel_(storedStatus),
    pendingTalentReview: true
  };
}

function getFlashMentoringAdminService_() {
  return {
    resolveSessionActor: resolveFlashMentoringSessionActor_,
    routeTalentException: routeFlashMentoringPortalException_,
    getBootstrap: getFlashMentoringAdminBootstrap_,
    listRequests: listFlashMentoringRequestsForAdmin_,
    getRequest: getFlashMentoringRequestForAdmin_,
    reviewRequest: reviewFlashMentoringRequest_,
    reviewMentor: reviewFlashMentoringMentor_,
    getMetrics: getFlashMentoringMetrics_
  };
}

function submitFlashMentoringRequest_(actor, payload) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  if (!hasFlashMentoringRole_(actor, 'MENTORADO')) {
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }
  payload = payload || {};
  if (payload.profileConfirmed !== true) {
    throw createFlashMentoringServiceError_('MENTEE_PROFILE_CONFIRMATION_REQUIRED');
  }
  if (payload.principlesAcknowledged !== true) {
    throw createFlashMentoringServiceError_('REQUEST_PRINCIPLES_ACKNOWLEDGEMENT_REQUIRED');
  }
  var topic = findFlashMentoringTopic_(payload.topicCategory, payload.topicName);
  if (!topic) throw createFlashMentoringServiceError_('REQUEST_TOPIC_INVALID');
  var challengeSummary = normalizeFlashMentoringRequestText_(payload.challengeSummary, 1200, true);
  var desiredOutcome = normalizeFlashMentoringRequestText_(payload.desiredOutcome, 1200, true);
  var repositories = getFlashMentoringRepositories_();
  var mentee = repositories.PEOPLE_MASTER.listAll().filter(function(person) {
    return String(person.personId) === String(actor.personId);
  })[0];
  if (!mentee) {
    queueFlashMentoringTalentReview_('PEOPLE_MASTER', actor.personId, 'MENTEE_PROFILE_MISSING');
    throw createFlashMentoringServiceError_('TALENT_REVIEW_REQUIRED');
  }

  var now = new Date().toISOString();
  var request = {
    requestId: Utilities.getUuid(),
    menteePersonId: String(actor.personId),
    topicCategory: topic.category,
    topicName: topic.topicName,
    challengeSummary: challengeSummary,
    desiredOutcome: desiredOutcome,
    consentAcknowledged: true,
    status: FLASH_MENTORING_REQUEST_STATUS.RH_REVIEW,
    currentShortlistVersion: 0,
    reviewedByPersonId: '',
    reviewDecision: '',
    reviewedAt: '',
    submittedAt: now,
    createdAt: now,
    updatedAt: now
  };
  repositories.REQUESTS.appendMany([request]);
  recordFlashMentoringAudit_(actor.personId, 'REQUEST_SUBMITTED', 'REQUESTS', request.requestId, {
    nextStatus: request.status
  }, 'REQUEST_SUBMITTED:' + request.requestId);

  if (typeof evaluateFlashMentoringEligibility_ !== 'function') {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'ELIGIBILITY_SERVICE_UNAVAILABLE', actor);
  }
  var eligibility = evaluateFlashMentoringEligibility_(makeFlashMentoringEligibilityPerson_(mentee));
  if (!eligibility || eligibility.eligible !== true) {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'MENTEE_ELIGIBILITY_REVIEW_REQUIRED', actor);
  }

  var matching = buildFlashMentoringShortlist_(repositories, mentee, request, []);
  if (!matching || matching.status !== 'SHORTLIST_READY' || !matching.recommendations.length) {
    var reasons = matching && Array.isArray(matching.reasonCodes) ? matching.reasonCodes : ['MATCHING_FAILED'];
    return routeFlashMentoringRequestToTalent_(repositories, request, reasons[0] || 'MATCHING_FAILED', actor);
  }

  var version = 1;
  var candidateRecords = createFlashMentoringCandidateRecords_(request, version, matching.recommendations, now);
  repositories.REQUEST_CANDIDATES.appendMany(candidateRecords);
  request.currentShortlistVersion = version;
  request.status = FLASH_MENTORING_REQUEST_STATUS.RH_REVIEW;
  request.reviewDecision = 'SHORTLIST_READY';
  request.updatedAt = now;
  repositories.REQUESTS.upsertMany([request]);

  if (!queueFlashMentoringRhReview_(repositories, mentee, request)) {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'HR_REPRESENTATIVE_CONFIGURATION_REQUIRED', actor);
  }
  recordFlashMentoringAudit_(actor.personId, 'REQUEST_SHORTLIST_READY', 'REQUESTS', request.requestId, {
    nextStatus: request.status,
    shortlistVersion: version,
    candidateCount: candidateRecords.length
  }, 'REQUEST_SHORTLIST_READY:' + request.requestId + ':' + version);
  return {
    requestId: request.requestId,
    status: request.status,
    statusLabel: getFlashMentoringStatusLabel_(request.status),
    candidateCount: candidateRecords.length
  };
}

function reviewFlashMentoringRequest_(principal, payload) {
  principal = requireVerifiedFlashMentoringActor_(principal);
  assertFlashMentoringAdminReviewer_(principal);
  payload = payload || {};
  var requestId = normalizeFlashMentoringId_(payload.requestId);
  var action = String(payload.action || '').toUpperCase();
  if (!requestId || ['APPROVE', 'REGENERATE', 'ESCALATE_TO_TALENT'].indexOf(action) < 0) {
    throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  }
  var repositories = getFlashMentoringRepositories_();
  var request = findFlashMentoringRequest_(repositories, requestId);
  if (!request) throw createFlashMentoringServiceError_('NOT_FOUND');
  assertFlashMentoringRequestReviewer_(principal, request, repositories);
  if (action === 'ESCALATE_TO_TALENT') {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'RH_ESCALATED_TO_TALENT', principal, 'ESCALATE_TO_TALENT');
  }
  if (action === 'REGENERATE') {
    return regenerateFlashMentoringShortlist_(principal, repositories, request);
  }
  if (String(request.status) === FLASH_MENTORING_REQUEST_STATUS.INVITING_MENTOR
      || String(request.status) === FLASH_MENTORING_REQUEST_STATUS.MATCHED) {
    return {
      requestId: requestId,
      status: String(request.status),
      statusLabel: getFlashMentoringStatusLabel_(request.status)
    };
  }
  if (String(request.status) !== FLASH_MENTORING_REQUEST_STATUS.RH_REVIEW) {
    throw createFlashMentoringServiceError_('CONFLICT');
  }

  var currentCandidates = listCurrentFlashMentoringCandidates_(repositories, request)
    .sort(function(a, b) { return Number(a.candidateOrder) - Number(b.candidateOrder); });
  if (!currentCandidates.length) {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'SHORTLIST_MISSING', principal);
  }
  var approvedIds = Array.isArray(payload.approvedCandidateIds)
    ? payload.approvedCandidateIds.map(normalizeFlashMentoringId_)
    : currentCandidates.map(function(candidate) { return String(candidate.candidateId); });
  if (!approvedIds.length || approvedIds.length > 3
      || approvedIds.some(function(id, index, values) { return !id || values.indexOf(id) !== index; })) {
    throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  }
  var candidateById = {};
  currentCandidates.forEach(function(candidate) { candidateById[String(candidate.candidateId)] = candidate; });
  if (approvedIds.some(function(id) { return !candidateById[id]; })) {
    throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  }

  var now = new Date().toISOString();
  var candidateUpdates = currentCandidates.map(function(candidate) {
    var selectedIndex = approvedIds.indexOf(String(candidate.candidateId));
    return {
      candidateId: String(candidate.candidateId),
      candidateOrder: selectedIndex >= 0 ? selectedIndex + 1 : candidate.candidateOrder,
      status: selectedIndex === 0
        ? FLASH_MENTORING_CANDIDATE_STATUS.INVITED
        : selectedIndex > 0
          ? FLASH_MENTORING_CANDIDATE_STATUS.APPROVED
          : FLASH_MENTORING_CANDIDATE_STATUS.NOT_SELECTED,
      updatedAt: now
    };
  });
  repositories.REQUEST_CANDIDATES.upsertMany(candidateUpdates);
  request.status = FLASH_MENTORING_REQUEST_STATUS.INVITING_MENTOR;
  request.reviewedByPersonId = String(principal.personId);
  request.reviewDecision = 'APPROVED';
  request.reviewedAt = now;
  request.updatedAt = now;
  repositories.REQUESTS.upsertMany([request]);

  var firstCandidate = candidateById[approvedIds[0]];
  if (!queueFlashMentorInvitation_(repositories, request, firstCandidate)) {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'MENTOR_INVITATION_CONFIGURATION_REQUIRED', principal);
  }
  recordFlashMentoringAudit_(principal.personId, 'REQUEST_APPROVED_FOR_SEQUENTIAL_INVITE', 'REQUESTS', requestId, {
    nextStatus: request.status,
    candidateCount: approvedIds.length
  }, 'REQUEST_APPROVED_FOR_INVITE:' + requestId);
  return { requestId: requestId, status: request.status, statusLabel: getFlashMentoringStatusLabel_(request.status) };
}

function reviewFlashMentoringMentor_(principal, payload) {
  principal = requireVerifiedFlashMentoringActor_(principal);
  if (!hasFlashMentoringRole_(principal, 'TALENT')) throw createFlashMentoringServiceError_('ACCESS_DENIED');
  payload = payload || {};
  var mentorPersonId = normalizeFlashMentoringId_(payload.mentorPersonId);
  var action = String(payload.action || '').toUpperCase();
  if (!mentorPersonId || ['APPROVE', 'PAUSE', 'REACTIVATE'].indexOf(action) < 0) {
    throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  }
  var repositories = getFlashMentoringRepositories_();
  var mentor = repositories.MENTORS.listAll().filter(function(record) {
    return String(record.personId) === mentorPersonId;
  })[0];
  if (!mentor) throw createFlashMentoringServiceError_('NOT_FOUND');

  var now = new Date().toISOString();
  var status = action === 'PAUSE'
    ? FLASH_MENTORING_MENTOR_STATUS.PAUSED
    : FLASH_MENTORING_MENTOR_STATUS.ACTIVE;
  mentor.status = status;
  mentor.curatedByPersonId = String(principal.personId);
  mentor.curatedAt = now;
  mentor.updatedAt = now;
  repositories.MENTORS.upsertMany([mentor]);
  setFlashMentoringRoleAssignment_(repositories, mentorPersonId, 'MENTOR', status === 'ACTIVE', principal.personId, now);
  recordFlashMentoringAudit_(principal.personId, 'MENTOR_CURATED', 'MENTORS', mentorPersonId, {
    decision: action,
    nextStatus: status
  }, 'MENTOR_CURATED:' + mentorPersonId + ':' + now);
  return {
    mentorPersonId: mentorPersonId,
    status: status,
    statusLabel: getFlashMentoringStatusLabel_(status)
  };
}

function respondToFlashMentoringInvitation_(actor, payload, actionOverride) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  if (!hasFlashMentoringRole_(actor, 'MENTOR')) throw createFlashMentoringServiceError_('ACCESS_DENIED');
  if (typeof payload === 'string') payload = { candidateId: payload, action: actionOverride };
  payload = payload || {};
  var candidateId = normalizeFlashMentoringId_(payload.candidateId);
  var action = String(payload.action || '').toUpperCase();
  if (!candidateId || ['ACCEPT', 'DECLINE', 'AVAILABLE_NEXT_MONTH'].indexOf(action) < 0) {
    throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  }
  if (action === 'AVAILABLE_NEXT_MONTH') {
    return recordFlashMentoringNextMonthAvailability_(actor, candidateId);
  }

  var repositories = getFlashMentoringRepositories_();
  var candidate = findFlashMentoringCandidate_(repositories, candidateId);
  if (!candidate || String(candidate.mentorPersonId) !== String(actor.personId)) {
    throw createFlashMentoringServiceError_('NOT_FOUND');
  }
  var request = findFlashMentoringRequest_(repositories, candidate.requestId);
  if (!request) return routeFlashMentoringRequestToTalent_(repositories, { requestId: candidate.requestId }, 'REQUEST_DATA_MISSING', actor);

  if (action === 'ACCEPT') return acceptFlashMentoringInvitation_(actor, repositories, request, candidate);
  return declineFlashMentoringInvitation_(actor, repositories, request, candidate);
}

function recordFlashMentoringNextMonthAvailability_(actor, candidateId) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  if (!hasFlashMentoringRole_(actor, 'MENTOR')) throw createFlashMentoringServiceError_('ACCESS_DENIED');
  var repositories = getFlashMentoringRepositories_();
  var candidate = findFlashMentoringCandidate_(repositories, candidateId);
  if (!candidate || String(candidate.mentorPersonId) !== String(actor.personId)) {
    throw createFlashMentoringServiceError_('NOT_FOUND');
  }
  if (candidate.status === FLASH_MENTORING_CANDIDATE_STATUS.NEXT_MONTH_PENDING) {
    return { requestId: candidate.requestId, status: FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW,
      statusLabel: getFlashMentoringStatusLabel_(FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW),
      nextMonthAvailabilityPending: true };
  }
  if (String(candidate.status) !== FLASH_MENTORING_CANDIDATE_STATUS.INVITED) {
    throw createFlashMentoringServiceError_('CONFLICT');
  }
  var request = findFlashMentoringRequest_(repositories, candidate.requestId);
  if (!request) return routeFlashMentoringRequestToTalent_(repositories, { requestId: candidate.requestId }, 'REQUEST_DATA_MISSING', actor);
  var now = new Date().toISOString();
  repositories.REQUEST_CANDIDATES.upsertMany([{
    candidateId: candidate.candidateId,
    status: FLASH_MENTORING_CANDIDATE_STATUS.NEXT_MONTH_PENDING,
    updatedAt: now
  }]);
  cancelFlashMentoringNotification_('REQUEST_CANDIDATES', candidate.candidateId,
    'MENTOR_INVITATION', 'NEXT_MONTH_RULE_PENDING');
  request.status = FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW;
  request.reviewDecision = 'NEXT_MONTH_AVAILABILITY_RULE_PENDING';
  request.updatedAt = now;
  repositories.REQUESTS.upsertMany([request]);
  recordFlashMentoringAudit_(actor.personId, 'NEXT_MONTH_AVAILABILITY_PENDING', 'REQUESTS', request.requestId, {
    reasonCode: 'NEXT_MONTH_AVAILABILITY_RULE_PENDING',
    nextStatus: request.status
  }, 'NEXT_MONTH_PENDING:' + candidate.candidateId);
  queueFlashMentoringTalentReview_('REQUESTS', request.requestId, 'NEXT_MONTH_AVAILABILITY_RULE_PENDING');
  return {
    requestId: String(request.requestId),
    status: request.status,
    statusLabel: getFlashMentoringStatusLabel_(request.status),
    nextMonthAvailabilityPending: true,
    matchCreated: false,
    slotReserved: false
  };
}

function updateFlashMentoringMatchProgress_(actor, payload) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  if (!hasFlashMentoringRole_(actor, 'MENTORADO')) throw createFlashMentoringServiceError_('ACCESS_DENIED');
  payload = payload || {};
  var matchId = normalizeFlashMentoringId_(payload.matchId);
  var progressType = String(payload.progressType || '').toUpperCase();
  var value = String(payload.value || '').toUpperCase();
  var scheduledAt = parseFlashMentoringFollowUpDate_(payload.scheduledAt);
  if (!matchId || ['SCHEDULING', 'OUTCOME'].indexOf(progressType) < 0) {
    throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  }
  var repositories = getFlashMentoringRepositories_();
  var match = repositories.MATCHES.listAll().filter(function(record) {
    return String(record.matchId) === matchId;
  })[0];
  if (!match || String(match.menteePersonId) !== String(actor.personId)) {
    throw createFlashMentoringServiceError_('NOT_FOUND');
  }
  if (isFlashMentoringMatchFinal_(String(match.status))) {
    var repeatedFinalStatus = progressType === 'OUTCOME'
      ? value === 'REALIZED' ? FLASH_MENTORING_MATCH_STATUSES.REALIZED
        : value === 'CANCELLED' || value === 'CANCELED' ? FLASH_MENTORING_MATCH_STATUSES.CANCELLED
          : value === 'NOT_REALIZED' || value === 'WILL_NOT_HAPPEN' ? FLASH_MENTORING_MATCH_STATUSES.NOT_REALIZED
            : ''
      : '';
    if (repeatedFinalStatus === String(match.status)) {
      return closeFlashMentoringMatch_(actor, repositories, match, repeatedFinalStatus);
    }
    throw createFlashMentoringServiceError_('CONFLICT');
  }
  if (!isFlashMentoringMatchActive_(String(match.status))) {
    throw createFlashMentoringServiceError_('CONFLICT');
  }

  if (progressType === 'SCHEDULING') {
    if (value === 'STILL_COORDINATING' || value === 'STILL_ALIGNING') {
      recordFlashMentoringProgress_(actor, match, 'STILL_ALIGNING');
      scheduleFlashMentoringFollowUpAfterProgress_(repositories, match, 'STILL_ALIGNING');
      return { matchId: matchId, status: String(match.status), statusLabel: getFlashMentoringStatusLabel_(match.status) };
    }
    if (value === 'UNABLE_TO_CONTACT' || value === 'NO_CONTACT') {
      recordFlashMentoringProgress_(actor, match, 'NO_CONTACT');
      scheduleFlashMentoringFollowUpAfterProgress_(repositories, match, 'NO_CONTACT');
      return { matchId: matchId, status: String(match.status), statusLabel: getFlashMentoringStatusLabel_(match.status) };
    }
    if (value !== 'SCHEDULED') throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
    if (!scheduledAt) {
      return routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_SCHEDULE_DATE_MISSING', actor);
    }
    return setFlashMentoringMatchSchedule_(actor, repositories, match, scheduledAt, 'SCHEDULED');
  }

  if (value === 'RESCHEDULED') {
    if (!scheduledAt) return routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_RESCHEDULE_DATE_MISSING', actor);
    return setFlashMentoringMatchSchedule_(actor, repositories, match, scheduledAt, 'RESCHEDULED');
  }
  if (value === 'REALIZED') {
    return closeFlashMentoringMatch_(actor, repositories, match, FLASH_MENTORING_MATCH_STATUSES.REALIZED);
  }
  if (value === 'CANCELLED' || value === 'CANCELED') {
    return closeFlashMentoringMatch_(actor, repositories, match, FLASH_MENTORING_MATCH_STATUSES.CANCELLED);
  }
  if (value === 'NOT_REALIZED' || value === 'WILL_NOT_HAPPEN') {
    return closeFlashMentoringMatch_(actor, repositories, match, FLASH_MENTORING_MATCH_STATUSES.NOT_REALIZED);
  }
  throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
}

function setFlashMentoringMatchSchedule_(actor, repositories, match, scheduledAt, followUpAction) {
  if (!isFlashMentoringMatchActive_(String(match.status))) {
    if (String(match.status) === FLASH_MENTORING_MATCH_STATUSES.SCHEDULED
        && parseFlashMentoringFollowUpDate_(match.scheduledAt)
        && parseFlashMentoringFollowUpDate_(match.scheduledAt).getTime() === scheduledAt.getTime()) {
      return { matchId: String(match.matchId), status: match.status, statusLabel: getFlashMentoringStatusLabel_(match.status), alreadyRecorded: true };
    }
    throw createFlashMentoringServiceError_('CONFLICT');
  }
  var acceptedAt = parseFlashMentoringFollowUpDate_(match.acceptedAt);
  var conversationDeadline = parseFlashMentoringFollowUpDate_(match.conversationDeadlineAt);
  if (!acceptedAt || !conversationDeadline) {
    return routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_DEADLINE_DATA_MISSING', actor);
  }
  if (scheduledAt.getTime() > conversationDeadline.getTime()) {
    return routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_DATE_OUTSIDE_WINDOW', actor);
  }
  var now = new Date().toISOString();
  repositories.MATCHES.upsertMany([{
    matchId: String(match.matchId),
    status: FLASH_MENTORING_MATCH_STATUSES.SCHEDULED,
    scheduledAt: scheduledAt.toISOString(),
    updatedAt: now
  }]);
  cancelFlashMentoringNotification_('MATCHES', match.matchId,
    'MATCH_OUTCOME_CHECKIN', 'MATCH_RESCHEDULED');
  match.status = FLASH_MENTORING_MATCH_STATUSES.SCHEDULED;
  match.scheduledAt = scheduledAt.toISOString();
  match.updatedAt = now;
  var request = findFlashMentoringRequest_(repositories, match.requestId);
  if (request) {
    request.status = FLASH_MENTORING_REQUEST_STATUS.IN_PROGRESS;
    request.updatedAt = now;
    repositories.REQUESTS.upsertMany([request]);
  }
  recordFlashMentoringProgress_(actor, match, followUpAction);
  scheduleFlashMentoringFollowUpAfterProgress_(repositories, match, followUpAction);
  return { matchId: String(match.matchId), status: match.status, statusLabel: getFlashMentoringStatusLabel_(match.status) };
}

function closeFlashMentoringMatch_(actor, repositories, match, finalStatus) {
  var alreadyClosed = isFlashMentoringMatchFinal_(String(match.status));
  if (alreadyClosed && String(match.status) !== String(finalStatus)) throw createFlashMentoringServiceError_('CONFLICT');
  var result = releaseFlashMentoringSlot_(repositories, match.matchId, finalStatus, actor.personId);
  if (!result || !result.match) throw createFlashMentoringServiceError_('MATCH_NOT_FOUND');
  if (result.inProgress) {
    return {
      matchId: String(match.matchId),
      status: String(match.status),
      statusLabel: getFlashMentoringStatusLabel_(match.status),
      pending: true
    };
  }
  var closedMatch = result.match;
  cancelFlashMentoringNotification_('MATCHES', closedMatch.matchId,
    'MENTEE_CONTACT_CHECKIN_D7', 'MATCH_CLOSED');
  cancelFlashMentoringNotification_('MATCHES', closedMatch.matchId,
    'MENTEE_CONTACT_REMINDER_', 'MATCH_CLOSED');
  cancelFlashMentoringNotification_('MATCHES', closedMatch.matchId,
    'MATCH_OUTCOME_CHECKIN', 'MATCH_CLOSED');
  var request = findFlashMentoringRequest_(repositories, closedMatch.requestId);
  if (request) {
    request.status = finalStatus;
    request.updatedAt = closedMatch.closedAt || new Date().toISOString();
    repositories.REQUESTS.upsertMany([request]);
  }
  recordFlashMentoringProgress_(actor, closedMatch, finalStatus);
  if (finalStatus === FLASH_MENTORING_MATCH_STATUSES.REALIZED) {
    queueFlashMentoringNotification_({
      recipientPersonId: closedMatch.menteePersonId,
      templateKey: 'MENTEE_PULSE_AVAILABLE',
      relatedEntity: 'MATCHES',
      relatedEntityId: closedMatch.matchId,
      scheduledAt: new Date(),
      dedupeKey: 'MENTEE_PULSE_AVAILABLE:' + closedMatch.matchId
    });
  }
  return {
    matchId: String(closedMatch.matchId),
    status: finalStatus,
    statusLabel: getFlashMentoringStatusLabel_(finalStatus),
    alreadyClosed: alreadyClosed || !result.changed
  };
}

function recordFlashMentoringProgress_(actor, match, action) {
  recordFlashMentoringAudit_(actor.personId, 'MATCH_PROGRESS_UPDATED', 'MATCHES', match.matchId, {
    followUpAction: String(action),
    matchStatus: String(match.status || '')
  }, 'MATCH_PROGRESS:' + match.matchId + ':' + String(action) + ':' + String(match.updatedAt || ''));
}

function acceptFlashMentoringInvitation_(actor, repositories, request, candidate) {
  var result;
  var matchId = flashMentoringStableId_('match', [request.requestId]);
  try {
    result = withFlashMentoringCapacityLock_(function() {
      var existingMatch = repositories.MATCHES.listAll().filter(function(match) {
        return String(match.requestId) === String(request.requestId);
      })[0];
      if (existingMatch) {
        if (String(existingMatch.mentorPersonId) !== String(actor.personId)) {
          return { conflict: true, match: existingMatch };
        }
        if (!isFlashMentoringMatchActive_(String(existingMatch.status))
            && !isFlashMentoringMatchFinal_(String(existingMatch.status))) {
          return { configurationIssue: true, reasonCode: 'MATCH_STATUS_INVALID' };
        }
        return {
          match: existingMatch,
          alreadyAccepted: true,
          terminal: isFlashMentoringMatchFinal_(String(existingMatch.status))
        };
      }
      var currentCandidate = findFlashMentoringCandidate_(repositories, candidate.candidateId);
      if (!currentCandidate || String(currentCandidate.mentorPersonId) !== String(actor.personId)
          || String(currentCandidate.status) !== FLASH_MENTORING_CANDIDATE_STATUS.INVITED) {
        return { invalidInvite: true };
      }
      var currentRequest = findFlashMentoringRequest_(repositories, request.requestId);
      if (!currentRequest || String(currentRequest.status) !== FLASH_MENTORING_REQUEST_STATUS.INVITING_MENTOR) {
        return { invalidInvite: true };
      }
      var currentInvites = repositories.REQUEST_CANDIDATES.listAll().filter(function(record) {
        return String(record.requestId) === String(request.requestId)
          && String(record.status) === FLASH_MENTORING_CANDIDATE_STATUS.INVITED;
      });
      if (currentInvites.length !== 1 || String(currentInvites[0].candidateId) !== String(candidate.candidateId)) {
        return { invalidInvite: true };
      }
      var mentor = repositories.MENTORS.listAll().filter(function(record) {
        return String(record.personId) === String(actor.personId);
      })[0];
      if (!mentor || String(mentor.status) !== FLASH_MENTORING_MENTOR_STATUS.ACTIVE
          || !isFlashMentoringRoleAssignmentActive_(repositories, actor.personId, 'MENTOR')) {
        return { configurationIssue: true, reasonCode: 'MENTOR_APPROVAL_CONFIGURATION_MISSING' };
      }
      var reservation = reserveFlashMentoringCapacitySlotLocked_(repositories, actor.personId, matchId);
      if (!reservation.reserved) return { capacityIssue: true };

      var now = new Date();
      var deadlines = getFlashMentoringBusinessDeadlines_(now);
      var match = {
        matchId: matchId,
        requestId: String(request.requestId),
        menteePersonId: String(request.menteePersonId),
        mentorPersonId: String(actor.personId),
        status: FLASH_MENTORING_MATCH_STATUSES.ACCEPTED,
        acceptedAt: now.toISOString(),
        firstContactDeadlineAt: deadlines.firstContactDeadlineAt.toISOString(),
        conversationDeadlineAt: deadlines.conversationDeadlineAt.toISOString(),
        scheduledAt: '',
        closedAt: '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
      return {
        match: match,
        alreadyAccepted: false,
        capacityReservationCreated: !reservation.alreadyReserved
      };
    });
  } catch (error) {
    var afterFailure = repositories.MATCHES.listAll().filter(function(match) {
      return String(match.requestId) === String(request.requestId);
    })[0];
    if (afterFailure && String(afterFailure.mentorPersonId) === String(actor.personId)) {
      result = { match: afterFailure, alreadyAccepted: true };
    } else {
      clearFlashMentoringCapacityReservation_(matchId);
      return routeFlashMentoringRequestToTalent_(repositories, request,
        error && error.code ? String(error.code) : 'CAPACITY_RESERVATION_FAILED', actor);
    }
  }
  if (result.conflict || result.invalidInvite) {
    throw createFlashMentoringServiceError_(result.conflict ? 'CONFLICT' : 'INVITE_NOT_ACTIVE');
  }
  if (result.capacityIssue || result.configurationIssue) {
    return routeFlashMentoringRequestToTalent_(repositories, request,
      result.configurationIssue ? result.reasonCode : 'MENTOR_CAPACITY_UNAVAILABLE', actor, 'ACCEPT');
  }

  var match = result.match;
  if (result.terminal) {
    var terminalRequest = findFlashMentoringRequest_(repositories, request.requestId) || request;
    return {
      requestId: String(request.requestId),
      matchId: String(match.matchId),
      status: String(terminalRequest.status || match.status),
      statusLabel: getFlashMentoringStatusLabel_(terminalRequest.status || match.status),
      alreadyAccepted: true
    };
  }
  if (!result.alreadyAccepted) {
    try {
      repositories.MATCHES.appendMany([match]);
    } catch (error) {
      var afterAppendFailure = repositories.MATCHES.listAll().filter(function(record) {
        return String(record.requestId) === String(request.requestId);
      })[0];
      if (afterAppendFailure && String(afterAppendFailure.mentorPersonId) === String(actor.personId)) {
        match = afterAppendFailure;
        result.alreadyAccepted = true;
      } else {
        clearFlashMentoringCapacityReservation_(matchId);
        return routeFlashMentoringRequestToTalent_(repositories, request,
          'CAPACITY_RESERVATION_WRITE_FAILED', actor, 'ACCEPT');
      }
    }
  }

  var nowText = new Date().toISOString();
  try {
    repositories.REQUEST_CANDIDATES.upsertMany([{
      candidateId: String(candidate.candidateId),
      status: FLASH_MENTORING_CANDIDATE_STATUS.ACCEPTED,
      updatedAt: nowText
    }]);
    repositories.REQUEST_CANDIDATES.listAll().filter(function(other) {
      return String(other.requestId) === String(request.requestId)
        && String(other.candidateId) !== String(candidate.candidateId)
        && String(other.status) === FLASH_MENTORING_CANDIDATE_STATUS.APPROVED;
    }).forEach(function(other) {
      repositories.REQUEST_CANDIDATES.upsertMany([{
        candidateId: String(other.candidateId),
        status: FLASH_MENTORING_CANDIDATE_STATUS.NOT_SELECTED,
        updatedAt: nowText
      }]);
    });
    var acceptedRequestStatus = String(match.status) === FLASH_MENTORING_MATCH_STATUSES.SCHEDULED
      ? FLASH_MENTORING_REQUEST_STATUS.IN_PROGRESS
      : FLASH_MENTORING_REQUEST_STATUS.MATCHED;
    repositories.REQUESTS.upsertMany([{
      requestId: String(request.requestId),
      status: acceptedRequestStatus,
      reviewDecision: match.status === FLASH_MENTORING_MATCH_STATUSES.SCHEDULED
        ? 'MENTOR_ACCEPTED_AND_SCHEDULED'
        : 'MENTOR_ACCEPTED',
      updatedAt: nowText
    }]);
    cancelFlashMentoringNotification_('REQUEST_CANDIDATES', candidate.candidateId,
      'MENTOR_INVITATION', 'INVITATION_ACCEPTED');
  } catch (error) {
    queueFlashMentoringTalentReview_('REQUESTS', request.requestId, 'MATCH_ACCEPTANCE_FOLLOW_UP_FAILED');
    recordFlashMentoringAudit_(actor.personId, 'MATCH_ACCEPTANCE_REPAIR_REQUIRED', 'MATCHES', match.matchId, {
      reasonCode: 'MATCH_ACCEPTANCE_FOLLOW_UP_FAILED'
    }, 'MATCH_ACCEPTANCE_REPAIR:' + match.matchId);
  }
  clearFlashMentoringCapacityReservation_(matchId);

  var acceptedAt = parseFlashMentoringFollowUpDate_(match.acceptedAt);
  if (!acceptedAt) {
    queueFlashMentoringTalentReview_('MATCHES', match.matchId, 'MATCH_ACCEPTED_AT_MISSING');
  }
  var acceptedNotifications = [
    queueFlashMentoringNotification_({
      recipientPersonId: match.menteePersonId,
      templateKey: 'MATCH_ACCEPTED_MENTEE',
      relatedEntity: 'MATCHES',
      relatedEntityId: match.matchId,
      scheduledAt: new Date(),
      dedupeKey: 'MATCH_ACCEPTED_MENTEE:' + match.matchId
    }),
    queueFlashMentoringNotification_({
      recipientPersonId: match.mentorPersonId,
      templateKey: 'MATCH_ACCEPTED_MENTOR',
      relatedEntity: 'MATCHES',
      relatedEntityId: match.matchId,
      scheduledAt: new Date(),
      dedupeKey: 'MATCH_ACCEPTED_MENTOR:' + match.matchId
    }),
    queueFlashMentoringNotification_({
      recipientPersonId: match.menteePersonId,
      templateKey: 'MENTEE_CONTACT_CHECKIN_D7',
      relatedEntity: 'MATCHES',
      relatedEntityId: match.matchId,
      scheduledAt: acceptedAt ? addFlashMentoringDays_(acceptedAt, 7) : new Date(),
      dedupeKey: 'CONTACT_CHECKIN_D7:' + match.matchId
    })
  ];
  if (acceptedNotifications.some(function(notification) { return !notification; })) {
    queueFlashMentoringTalentReview_('MATCHES', match.matchId, 'MATCH_NOTIFICATION_QUEUE_FAILED');
  }
  recordFlashMentoringAudit_(actor.personId, 'MATCH_CREATED_AFTER_ACCEPTANCE', 'MATCHES', match.matchId, {
    nextStatus: FLASH_MENTORING_MATCH_STATUSES.ACCEPTED,
    capacityLimit: getSafeFlashMentoringCapacityLimit_(repositories, actor.personId)
  }, 'MATCH_CREATED:' + match.matchId);
  return {
    requestId: String(request.requestId),
    matchId: String(match.matchId),
    status: String(match.status) === FLASH_MENTORING_MATCH_STATUSES.SCHEDULED
      ? FLASH_MENTORING_REQUEST_STATUS.IN_PROGRESS
      : FLASH_MENTORING_REQUEST_STATUS.MATCHED,
    statusLabel: getFlashMentoringStatusLabel_(String(match.status) === FLASH_MENTORING_MATCH_STATUSES.SCHEDULED
      ? FLASH_MENTORING_REQUEST_STATUS.IN_PROGRESS
      : FLASH_MENTORING_REQUEST_STATUS.MATCHED),
    alreadyAccepted: !!result.alreadyAccepted
  };
}

function declineFlashMentoringInvitation_(actor, repositories, request, candidate) {
  if (String(candidate.status) === FLASH_MENTORING_CANDIDATE_STATUS.DECLINED) {
    var existingInvite = repositories.REQUEST_CANDIDATES.listAll().filter(function(record) {
      return String(record.requestId) === String(request.requestId)
        && String(record.status) === FLASH_MENTORING_CANDIDATE_STATUS.INVITED;
    })[0];
    if (existingInvite) return { requestId: String(request.requestId), status: request.status,
      statusLabel: getFlashMentoringStatusLabel_(request.status), alreadyDeclined: true };
  } else if (String(candidate.status) !== FLASH_MENTORING_CANDIDATE_STATUS.INVITED) {
    throw createFlashMentoringServiceError_('CONFLICT');
  }
  var now = new Date().toISOString();
  if (String(candidate.status) !== FLASH_MENTORING_CANDIDATE_STATUS.DECLINED) {
    repositories.REQUEST_CANDIDATES.upsertMany([{
      candidateId: String(candidate.candidateId),
      status: FLASH_MENTORING_CANDIDATE_STATUS.DECLINED,
      updatedAt: now
    }]);
    recordFlashMentoringAudit_(actor.personId, 'MENTOR_DECLINED_INVITATION', 'REQUESTS', request.requestId, {
      nextStatus: FLASH_MENTORING_REQUEST_STATUS.INVITING_MENTOR
    }, 'MENTOR_DECLINED:' + candidate.candidateId);
    cancelFlashMentoringNotification_('REQUEST_CANDIDATES', candidate.candidateId,
      'MENTOR_INVITATION', 'INVITATION_DECLINED');
  }
  var nextCandidate = repositories.REQUEST_CANDIDATES.listAll().filter(function(record) {
    return String(record.requestId) === String(request.requestId)
      && String(record.status) === FLASH_MENTORING_CANDIDATE_STATUS.APPROVED;
  }).sort(function(a, b) { return Number(a.candidateOrder) - Number(b.candidateOrder); })[0];
  if (!nextCandidate) {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'APPROVED_SHORTLIST_EXHAUSTED', actor);
  }
  nextCandidate.status = FLASH_MENTORING_CANDIDATE_STATUS.INVITED;
  nextCandidate.updatedAt = now;
  repositories.REQUEST_CANDIDATES.upsertMany([{
    candidateId: String(nextCandidate.candidateId),
    status: FLASH_MENTORING_CANDIDATE_STATUS.INVITED,
    updatedAt: now
  }]);
  request.status = FLASH_MENTORING_REQUEST_STATUS.INVITING_MENTOR;
  request.updatedAt = now;
  repositories.REQUESTS.upsertMany([request]);
  if (!queueFlashMentorInvitation_(repositories, request, nextCandidate)) {
    return routeFlashMentoringRequestToTalent_(repositories, request, 'NEXT_MENTOR_INVITATION_FAILED', actor);
  }
  return { requestId: String(request.requestId), status: request.status, statusLabel: getFlashMentoringStatusLabel_(request.status) };
}

function regenerateFlashMentoringShortlist_(principal, repositories, request) {
  if (String(request.status) !== FLASH_MENTORING_REQUEST_STATUS.RH_REVIEW) {
    throw createFlashMentoringServiceError_('CONFLICT');
  }
  var allCandidates = repositories.REQUEST_CANDIDATES.listAll().filter(function(candidate) {
    return String(candidate.requestId) === String(request.requestId);
  });
  var excludedMentorIds = allCandidates.map(function(candidate) {
    return String(candidate.mentorPersonId || '');
  }).filter(function(id, index, values) { return id && values.indexOf(id) === index; });
  var mentee = repositories.PEOPLE_MASTER.listAll().filter(function(person) {
    return String(person.personId) === String(request.menteePersonId);
  })[0];
  if (!mentee) return routeFlashMentoringRequestToTalent_(repositories, request, 'MENTEE_PROFILE_MISSING', principal);

  var currentVersion = normalizeFlashMentoringInteger_(request.currentShortlistVersion, 0, 10000, 0);
  var nextVersion = currentVersion + 1;
  var now = new Date().toISOString();
  repositories.REQUEST_CANDIDATES.upsertMany(allCandidates
    .filter(function(candidate) { return Number(candidate.shortlistVersion) === currentVersion; })
    .map(function(candidate) {
      return { candidateId: String(candidate.candidateId), status: FLASH_MENTORING_CANDIDATE_STATUS.SUPERSEDED, updatedAt: now };
    }));

  var matching = buildFlashMentoringShortlist_(repositories, mentee, request, excludedMentorIds);
  if (!matching || matching.status !== 'SHORTLIST_READY' || !matching.recommendations.length) {
    var reasons = matching && Array.isArray(matching.reasonCodes) ? matching.reasonCodes : ['NO_NEW_MENTOR_OPTIONS'];
    return routeFlashMentoringRequestToTalent_(repositories, request, reasons[0] || 'NO_NEW_MENTOR_OPTIONS', principal);
  }
  var candidateRecords = createFlashMentoringCandidateRecords_(request, nextVersion, matching.recommendations, now);
  repositories.REQUEST_CANDIDATES.appendMany(candidateRecords);
  request.currentShortlistVersion = nextVersion;
  request.status = FLASH_MENTORING_REQUEST_STATUS.RH_REVIEW;
  request.reviewedByPersonId = String(principal.personId);
  request.reviewDecision = 'REGENERATED';
  request.reviewedAt = now;
  request.updatedAt = now;
  repositories.REQUESTS.upsertMany([request]);
  recordFlashMentoringAudit_(principal.personId, 'REQUEST_SHORTLIST_REGENERATED', 'REQUESTS', request.requestId, {
    nextStatus: request.status,
    shortlistVersion: nextVersion,
    candidateCount: candidateRecords.length
  }, 'REQUEST_SHORTLIST_REGENERATED:' + request.requestId + ':' + nextVersion);
  return { requestId: String(request.requestId), status: request.status, statusLabel: getFlashMentoringStatusLabel_(request.status) };
}

function buildFlashMentoringShortlist_(repositories, mentee, request, excludedMentorIds) {
  try {
    if (typeof generateFlashMentoringShortlist_ !== 'function') {
      return { status: 'TALENT_REVIEW_REQUIRED', reasonCodes: ['MATCHING_SERVICE_UNAVAILABLE'], recommendations: [] };
    }
    var people = repositories.PEOPLE_MASTER.listAll();
    var peopleById = makeFlashMentoringPersonMap_(people);
    var mentorRecords = repositories.MENTORS.listAll();
    var topicRecords = repositories.MENTOR_TOPICS.listAll();
    var availableCapacityByMentorId = getFlashMentoringCapacityMap_(repositories, mentorRecords);
    var mentors = mentorRecords.map(function(record) {
      var mentorPerson = peopleById[String(record.personId)] || {};
      var approved = String(record.status) === FLASH_MENTORING_MENTOR_STATUS.ACTIVE;
      var topics = topicRecords.filter(function(topic) {
        return String(topic.mentorPersonId) === String(record.personId)
          && String(topic.topicName || '').trim() !== ''
          && findFlashMentoringTopic_(topic.category, topic.topicName);
      }).map(function(topic) { return String(topic.topicName); });
      return {
        id: String(record.personId || ''),
        active: approved,
        talentApproved: approved,
        topics: topics,
        seniority: String(mentorPerson.careerLevel || ''),
        name: String(mentorPerson.displayName || ''),
        role: String(mentorPerson.jobTitle || ''),
        cluster: String(mentorPerson.cluster || ''),
        area: String(mentorPerson.area || '')
      };
    });
    var personForMatching = makeFlashMentoringEligibilityPerson_(mentee);
    var result = generateFlashMentoringShortlist_(
      personForMatching,
      { topic: String(request.topicName || '') },
      mentors,
      availableCapacityByMentorId,
      excludedMentorIds || []
    );
    if (result.status === 'TALENT_REVIEW_REQUIRED') {
      recordFlashMentoringAudit_('', 'MATCHING_ROUTED_TO_TALENT', 'REQUESTS', request.requestId, {
        reasonCode: result.reasonCodes && result.reasonCodes[0] ? result.reasonCodes[0] : 'MATCHING_REVIEW_REQUIRED'
      });
    }
    return result;
  } catch (error) {
    recordFlashMentoringAudit_('', 'MATCHING_FAILED', 'REQUESTS', request.requestId, {
      reasonCode: error && error.code ? String(error.code) : 'MATCHING_DATA_UNAVAILABLE'
    });
    return { status: 'TALENT_REVIEW_REQUIRED', reasonCodes: ['MATCHING_DATA_UNAVAILABLE'], recommendations: [] };
  }
}

function createFlashMentoringCandidateRecords_(request, version, recommendations, now) {
  return (recommendations || []).slice(0, 3).map(function(recommendation, index) {
    var candidateId = flashMentoringStableId_('candidate', [request.requestId, version, recommendation.mentorId]);
    return {
      candidateId: candidateId,
      requestId: String(request.requestId),
      shortlistVersion: version,
      candidateOrder: index + 1,
      mentorPersonId: String(recommendation.mentorId),
      rationale: Array.isArray(recommendation.reasonCodes) ? recommendation.reasonCodes.join(',') : '',
      status: FLASH_MENTORING_CANDIDATE_STATUS.RECOMMENDED,
      createdAt: now,
      updatedAt: now
    };
  });
}

function routeFlashMentoringRequestToTalent_(repositories, request, reasonCode, actor, decision) {
  request = request || {};
  var requestId = String(request.requestId || '');
  var storedRequest = requestId ? findFlashMentoringRequest_(repositories, requestId) : null;
  var target = storedRequest || request;
  var previousStatus = String(target.status || '');
  var now = new Date().toISOString();
  var targetDecision = decision || 'TALENT_REVIEW_REQUIRED';
  if (storedRequest && (previousStatus !== FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW
      || String(target.reviewDecision || '') !== String(targetDecision))) {
    target.status = FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW;
    target.reviewDecision = targetDecision;
    if (actor && actor.personId && hasFlashMentoringRole_(actor, 'RH')) {
      target.reviewedByPersonId = String(actor.personId);
      target.reviewedAt = now;
    }
    target.updatedAt = now;
    repositories.REQUESTS.upsertMany([target]);
  }
  if (storedRequest) {
    try {
      var candidates = repositories.REQUEST_CANDIDATES.listAll().filter(function(candidate) {
        return String(candidate.requestId) === requestId;
      });
      var invitations = candidates.filter(function(candidate) {
        return String(candidate.status) === FLASH_MENTORING_CANDIDATE_STATUS.INVITED;
      });
      if (invitations.length) {
        repositories.REQUEST_CANDIDATES.upsertMany(invitations.map(function(candidate) {
          return {
            candidateId: String(candidate.candidateId),
            status: FLASH_MENTORING_CANDIDATE_STATUS.TALENT_REVIEW_PENDING,
            updatedAt: now
          };
        }));
      }
      candidates.forEach(function(candidate) {
        cancelFlashMentoringNotification_('REQUEST_CANDIDATES', candidate.candidateId,
          'MENTOR_INVITATION', 'REQUEST_ROUTED_TO_TALENT');
      });
    } catch (error) {
      Logger.log('FLASH_MENTORING_STALE_INVITATION_CANCEL_FAILED');
    }
  }
  recordFlashMentoringAudit_(actor && actor.personId, 'REQUEST_ROUTED_TO_TALENT', 'REQUESTS', requestId, {
    reasonCode: String(reasonCode || 'TALENT_REVIEW_REQUIRED'),
    previousStatus: previousStatus,
    nextStatus: FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW
  }, 'REQUEST_ROUTED_TO_TALENT:' + (requestId || String(reasonCode)) + ':' + String(reasonCode));
  try {
    queueFlashMentoringTalentReview_('REQUESTS', requestId, String(reasonCode || 'TALENT_REVIEW_REQUIRED'));
  } catch (error) {
    Logger.log('FLASH_MENTORING_TALENT_REVIEW_QUEUE_FAILED');
  }
  return {
    requestId: requestId,
    status: FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW,
    statusLabel: getFlashMentoringStatusLabel_(FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW),
    pending: true
  };
}

function routeFlashMentoringMatchToTalent_(repositories, match, reasonCode, actor) {
  var request = findFlashMentoringRequest_(repositories, match.requestId);
  var previousRequestStatus = request ? String(request.status || '') : '';
  var nextRequestStatus = previousRequestStatus;
  var normalizedReason = String(reasonCode || 'TALENT_REVIEW_REQUIRED');
  if (request && [
    FLASH_MENTORING_REQUEST_STATUS.REALIZED,
    FLASH_MENTORING_REQUEST_STATUS.CANCELLED,
    FLASH_MENTORING_REQUEST_STATUS.NOT_REALIZED
  ].indexOf(previousRequestStatus) < 0
      && (previousRequestStatus !== FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW
        || String(request.reviewDecision || '') !== normalizedReason)) {
    request.status = FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW;
    request.reviewDecision = normalizedReason;
    request.updatedAt = new Date().toISOString();
    repositories.REQUESTS.upsertMany([request]);
    nextRequestStatus = request.status;
  }
  recordFlashMentoringAudit_(actor && actor.personId, 'MATCH_ROUTED_TO_TALENT', 'MATCHES', match.matchId, {
    reasonCode: normalizedReason,
    previousStatus: previousRequestStatus,
    nextStatus: nextRequestStatus,
    matchStatus: String(match.status || '')
  }, 'MATCH_ROUTED_TO_TALENT:' + String(match.matchId) + ':' + normalizedReason);
  queueFlashMentoringTalentReview_('MATCHES', match.matchId, normalizedReason);
  return {
    matchId: String(match.matchId),
    status: FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW,
    statusLabel: getFlashMentoringStatusLabel_(FLASH_MENTORING_REQUEST_STATUS.TALENT_REVIEW),
    pending: true
  };
}

function queueFlashMentoringRhReview_(repositories, mentee, request) {
  var rhRepresentativeId = normalizeFlashMentoringId_(mentee && mentee.hrRepresentativePersonId);
  if (!rhRepresentativeId || !isFlashMentoringRoleAssignmentActive_(repositories, rhRepresentativeId, 'RH')) return false;
  return !!queueFlashMentoringNotification_({
    recipientPersonId: rhRepresentativeId,
    templateKey: 'RH_REQUEST_REVIEW',
    relatedEntity: 'REQUESTS',
    relatedEntityId: request.requestId,
    scheduledAt: new Date(),
    dedupeKey: 'RH_REQUEST_REVIEW:' + request.requestId
  });
}

function queueFlashMentorInvitation_(repositories, request, candidate) {
  if (!candidate || !isFlashMentoringRoleAssignmentActive_(repositories, candidate.mentorPersonId, 'MENTOR')) return false;
  var mentor = repositories.MENTORS.listAll().filter(function(record) {
    return String(record.personId) === String(candidate.mentorPersonId);
  })[0];
  if (!mentor || String(mentor.status) !== FLASH_MENTORING_MENTOR_STATUS.ACTIVE) return false;
  var queued = queueFlashMentoringNotification_({
    recipientPersonId: String(candidate.mentorPersonId),
    templateKey: 'MENTOR_INVITATION',
    relatedEntity: 'REQUEST_CANDIDATES',
    relatedEntityId: candidate.candidateId,
    scheduledAt: new Date(),
    dedupeKey: 'MENTOR_INVITATION:' + candidate.candidateId
  });
  return !!queued;
}

function assertFlashMentoringAdminReviewer_(principal) {
  if (!hasFlashMentoringRole_(principal, 'RH') && !hasFlashMentoringRole_(principal, 'TALENT')) {
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }
}

function assertFlashMentoringRequestReviewer_(principal, request, repositories) {
  if (hasFlashMentoringRole_(principal, 'TALENT')) return true;
  if (!hasFlashMentoringRole_(principal, 'RH')) throw createFlashMentoringServiceError_('ACCESS_DENIED');
  var mentee = repositories.PEOPLE_MASTER.listAll().filter(function(person) {
    return String(person.personId) === String(request.menteePersonId);
  })[0];
  if (!mentee || !mentee.hrRepresentativePersonId) {
    queueFlashMentoringTalentReview_('REQUESTS', request.requestId, 'HR_REPRESENTATIVE_MISSING');
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }
  if (String(mentee.hrRepresentativePersonId) !== String(principal.personId)) {
    queueFlashMentoringTalentReview_('REQUESTS', request.requestId, 'RH_SCOPE_MISMATCH');
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }
  return true;
}

function filterFlashMentoringRequestsForAdmin_(principal, requests, repositories) {
  if (hasFlashMentoringRole_(principal, 'TALENT')) return requests;
  var peopleById = makeFlashMentoringPersonMap_(repositories.PEOPLE_MASTER.listAll());
  return requests.filter(function(request) {
    var mentee = peopleById[String(request.menteePersonId)] || {};
    if (!mentee.hrRepresentativePersonId) {
      queueFlashMentoringTalentReview_('REQUESTS', request.requestId, 'HR_REPRESENTATIVE_MISSING');
      return false;
    }
    return String(mentee.hrRepresentativePersonId) === String(principal.personId);
  });
}

function listFlashMentoringMentorDtos_(repositories, limit) {
  var peopleById = makeFlashMentoringPersonMap_(repositories.PEOPLE_MASTER.listAll());
  var topicRows = repositories.MENTOR_TOPICS.listAll();
  return repositories.MENTORS.listAll().slice(0, limit || 200).map(function(mentor) {
    var person = peopleById[String(mentor.personId)] || {};
    var capacity = null;
    try {
      capacity = getFlashMentoringCapacitySnapshot_(repositories, mentor.personId);
    } catch (error) {
      queueFlashMentoringTalentReview_('MENTORS', mentor.personId, 'MENTOR_CAPACITY_DATA_UNAVAILABLE');
    }
    return {
      mentorId: String(mentor.personId),
      displayName: String(person.displayName || ''),
      jobTitle: String(person.jobTitle || ''),
      area: String(person.area || ''),
      unit: String(person.unit || ''),
      status: String(mentor.status || ''),
      topics: topicRows.filter(function(topic) {
        return String(topic.mentorPersonId) === String(mentor.personId) && String(topic.topicName || '').trim();
      }).slice(0, 5).map(function(topic) { return String(topic.topicName); }),
      experienceSummary: String(mentor.experienceSummary || ''),
      capacityLimit: normalizeFlashMentoringCapacityLimit_(mentor.capacityLimit),
      activeConnections: capacity ? capacity.occupiedCount : null,
      availableSlots: capacity ? capacity.availableCount : null,
      updatedAt: formatFlashMentoringDate_(mentor.updatedAt)
    };
  });
}

function listCurrentFlashMentoringCandidates_(repositories, request) {
  var version = normalizeFlashMentoringInteger_(request.currentShortlistVersion, 0, 10000, 0);
  return repositories.REQUEST_CANDIDATES.listAll().filter(function(candidate) {
    return String(candidate.requestId) === String(request.requestId)
      && Number(candidate.shortlistVersion) === version;
  });
}

function findFlashMentoringRequest_(repositories, requestId) {
  var normalizedId = normalizeFlashMentoringId_(requestId);
  if (!normalizedId) return null;
  return repositories.REQUESTS.listAll().filter(function(request) {
    return String(request.requestId) === normalizedId;
  })[0] || null;
}

function findFlashMentoringCandidate_(repositories, candidateId) {
  var normalizedId = normalizeFlashMentoringId_(candidateId);
  if (!normalizedId) return null;
  return repositories.REQUEST_CANDIDATES.listAll().filter(function(candidate) {
    return String(candidate.candidateId) === normalizedId;
  })[0] || null;
}

function isFlashMentoringRoleAssignmentActive_(repositories, personId, roleCode) {
  return repositories.ACCESS_ROLES.listAll().some(function(assignment) {
    return String(assignment.personId) === String(personId)
      && String(assignment.roleCode) === String(roleCode)
      && !hasFlashMentoringValue_(assignment.revokedAt);
  });
}

function setFlashMentoringRoleAssignment_(repositories, personId, roleCode, active, grantedByPersonId, now) {
  var rows = repositories.ACCESS_ROLES.listAll().filter(function(assignment) {
    return String(assignment.personId) === String(personId)
      && String(assignment.roleCode) === String(roleCode);
  });
  var activeRows = rows.filter(function(assignment) { return !hasFlashMentoringValue_(assignment.revokedAt); });
  if (active && activeRows.length) return activeRows[0];
  var assignmentId = flashMentoringStableId_('role', [personId, roleCode]);
  var existing = rows.filter(function(assignment) { return String(assignment.roleAssignmentId) === assignmentId; })[0];
  var record = {
    roleAssignmentId: assignmentId,
    personId: String(personId),
    roleCode: String(roleCode),
    grantedByPersonId: String(grantedByPersonId || ''),
    grantedAt: active ? now : (existing && existing.grantedAt ? existing.grantedAt : now),
    revokedAt: active ? '' : now
  };
  if (!active) {
    var revocations = activeRows.filter(function(row) { return row.roleAssignmentId !== assignmentId; }).map(function(row) {
      return { roleAssignmentId: String(row.roleAssignmentId), revokedAt: now };
    });
    if (revocations.length) repositories.ACCESS_ROLES.upsertMany(revocations);
  }
  repositories.ACCESS_ROLES.upsertMany([record]);
  return record;
}

function getFlashMentoringTopicCatalog_() {
  var grouped = {};
  FLASH_MENTORING_TOPIC_CATALOG.forEach(function(topic) {
    if (!grouped[topic.category]) grouped[topic.category] = [];
    grouped[topic.category].push(topic.topicName);
  });
  return Object.keys(grouped).map(function(category) {
    return { category: category, topics: grouped[category].slice() };
  });
}

function listFlashMentoringTopicsForPerson_(repositories, personId) {
  return repositories.MENTOR_TOPICS.listAll().filter(function(topic) {
    return String(topic.mentorPersonId) === String(personId)
      && String(topic.topicName || '').trim() !== '';
  }).map(function(topic) {
    return { category: String(topic.category || ''), topicName: String(topic.topicName || '') };
  }).slice(0, 5);
}

function validateFlashMentoringTopics_(topics, maximum, minimum) {
  if (!Array.isArray(topics) || topics.length < minimum || topics.length > maximum) {
    throw createFlashMentoringServiceError_('MENTOR_TOPIC_COUNT_INVALID');
  }
  var result = [];
  topics.forEach(function(topic) {
    var normalized = findFlashMentoringTopic_(topic && topic.category, topic && topic.topicName);
    if (!normalized) throw createFlashMentoringServiceError_('MENTOR_TOPIC_INVALID');
    var duplicate = result.some(function(item) {
      return item.category === normalized.category && item.topicName === normalized.topicName;
    });
    if (!duplicate) result.push(normalized);
  });
  if (result.length < minimum || result.length > maximum) throw createFlashMentoringServiceError_('MENTOR_TOPIC_COUNT_INVALID');
  return result;
}

function findFlashMentoringTopic_(category, topicName) {
  var normalizedCategory = normalizeFlashMentoringDomainText_(category);
  var normalizedTopic = normalizeFlashMentoringDomainText_(topicName);
  return FLASH_MENTORING_TOPIC_CATALOG.filter(function(topic) {
    return normalizeFlashMentoringDomainText_(topic.category) === normalizedCategory
      && normalizeFlashMentoringDomainText_(topic.topicName) === normalizedTopic;
  })[0] || null;
}

function upsertFlashMentoringTopicSlots_(repositories, personId, topics, now) {
  var rows = repositories.MENTOR_TOPICS.listAll();
  var slots = [];
  for (var index = 0; index < 5; index += 1) {
    var mentorTopicId = flashMentoringStableId_('mentor_topic', [personId, index + 1]);
    var old = rows.filter(function(record) { return String(record.mentorTopicId) === mentorTopicId; })[0];
    var topic = topics[index] || { category: '', topicName: '' };
    slots.push({
      mentorTopicId: mentorTopicId,
      mentorPersonId: String(personId),
      category: topic.category,
      topicName: topic.topicName,
      experienceTag: '',
      createdAt: old && old.createdAt ? old.createdAt : now
    });
  }
  repositories.MENTOR_TOPICS.upsertMany(slots);
}

function makeFlashMentoringPersonMap_(people) {
  var map = {};
  (people || []).forEach(function(person) { map[String(person.personId)] = person; });
  return map;
}

function makeFlashMentoringEligibilityPerson_(person) {
  return {
    active: person.active,
    wcBc: person.wcBc,
    cluster: person.cluster,
    descricaoNivel1: person.descricaoNivel1,
    role: person.jobTitle,
    directManagerId: person.immediateManagerPersonId
  };
}

function normalizeFlashMentoringRequestText_(value, maxLength, required) {
  if (value == null) value = '';
  if (typeof value !== 'string') throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  var normalized = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  if (required && !normalized) throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  if (normalized.length > maxLength) throw createFlashMentoringServiceError_('INVALID_ARGUMENT');
  return normalized;
}

function normalizeFlashMentoringInteger_(value, minimum, maximum, fallback) {
  if (value == null || value === '') return fallback;
  var number = typeof value === 'number' ? value : Number(String(value).trim());
  if (!isFinite(number) || Math.floor(number) !== number || number < minimum || number > maximum) return fallback;
  return number;
}

function normalizeFlashMentoringId_(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

function normalizeFlashMentoringDomainText_(value) {
  return String(value == null ? '' : value).trim().toLocaleLowerCase('pt-BR');
}

function compareFlashMentoringDates_(left, right) {
  var leftDate = parseFlashMentoringFollowUpDate_(left);
  var rightDate = parseFlashMentoringFollowUpDate_(right);
  return (rightDate ? rightDate.getTime() : 0) - (leftDate ? leftDate.getTime() : 0);
}

function formatFlashMentoringDate_(value) {
  var date = parseFlashMentoringFollowUpDate_(value);
  return date ? date.toISOString() : '';
}

function getFlashMentoringRequestStatusCodes_() {
  return Object.keys(FLASH_MENTORING_REQUEST_STATUS).map(function(key) { return FLASH_MENTORING_REQUEST_STATUS[key]; });
}

function getFlashMentoringStatusLabel_(status) {
  var labels = {
    RH_REVIEW: 'Aguardando revisão de RH',
    INVITING_MENTOR: 'Aguardando resposta do mentor',
    MATCHED: 'Conexão aceita',
    IN_PROGRESS: 'Em acompanhamento',
    TALENT_REVIEW: 'Pendente para análise de Talent',
    REALIZED: 'Realizada',
    CANCELLED: 'Cancelada',
    NOT_REALIZED: 'Não realizada',
    PENDING_REVIEW: 'Aguardando curadoria de Talent',
    ACTIVE: 'Ativo',
    PAUSED: 'Pausado',
    REJECTED: 'Não aprovado',
    RECOMMENDED: 'Recomendado',
    APPROVED: 'Aprovado na shortlist',
    INVITED: 'Convite enviado',
    ACCEPTED: 'Aceito',
    DECLINED: 'Recusado',
    SUPERSEDED: 'Substituído por novas opções',
    TALENT_REVIEW_PENDING: 'Pendente para análise de Talent',
    AVAILABLE_NEXT_MONTH_PENDING: 'Pendente para análise de Talent',
    CAPACITY_UNAVAILABLE: 'Capacidade precisa de revisão'
  };
  return labels[String(status || '')] || 'Em acompanhamento';
}

function getSafeFlashMentoringCapacityLimit_(repositories, mentorPersonId) {
  try {
    return getFlashMentoringCapacitySnapshot_(repositories, mentorPersonId).capacityLimit;
  } catch (error) {
    return null;
  }
}
