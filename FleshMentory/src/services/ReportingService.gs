function getFlashMentoringMetrics_(principal) {
  principal = requireVerifiedFlashMentoringActor_(principal);
  assertFlashMentoringAdminReviewer_(principal);

  var repositories = getFlashMentoringRepositories_();
  var allRequests = repositories.REQUESTS.listAll();
  var scopedRequests = filterFlashMentoringRequestsForAdmin_(principal, allRequests, repositories);
  var visibleRequestIds = Object.create(null);
  scopedRequests.forEach(function(request) {
    visibleRequestIds[String(request.requestId)] = true;
  });

  var activeMentors = repositories.MENTORS.listAll().filter(function(mentor) {
    if (String(mentor.status) !== FLASH_MENTORING_MENTOR_STATUS.ACTIVE) return false;
    if (!isFlashMentoringRoleAssignmentActive_(repositories, mentor.personId, 'MENTOR')) {
      queueFlashMentoringTalentReview_('MENTORS', mentor.personId, 'MENTOR_ROLE_ASSIGNMENT_MISSING');
    }
    return true;
  });

  var visibleMatches = repositories.MATCHES.listAll().filter(function(match) {
    return !!visibleRequestIds[String(match.requestId)];
  });
  var acceptedMatchIds = Object.create(null);
  var realizedCount = 0;
  var acceptedCount = 0;
  visibleMatches.forEach(function(match) {
    var status = String(match.status || '');
    if ([
      FLASH_MENTORING_MATCH_STATUSES.ACCEPTED,
      FLASH_MENTORING_MATCH_STATUSES.SCHEDULED,
      FLASH_MENTORING_MATCH_STATUSES.REALIZED,
      FLASH_MENTORING_MATCH_STATUSES.CANCELLED,
      FLASH_MENTORING_MATCH_STATUSES.NOT_REALIZED
    ].indexOf(status) < 0) {
      queueFlashMentoringTalentReview_('MATCHES', match.matchId, 'MATCH_STATUS_INVALID');
      return;
    }
    acceptedCount += 1;
    acceptedMatchIds[String(match.matchId)] = status;
    if (status === FLASH_MENTORING_MATCH_STATUSES.REALIZED) realizedCount += 1;
  });

  var pulsesByMatch = Object.create(null);
  repositories.PULSE.listAll().forEach(function(pulse) {
    if (!Object.prototype.hasOwnProperty.call(acceptedMatchIds, String(pulse.matchId))) return;
    var matchStatus = acceptedMatchIds[String(pulse.matchId)];
    if (matchStatus !== FLASH_MENTORING_MATCH_STATUSES.REALIZED) {
      queueFlashMentoringTalentReview_('PULSE', pulse.pulseId, 'PULSE_MATCH_NOT_REALIZED');
      return;
    }
    var matchId = String(pulse.matchId);
    if (pulsesByMatch[matchId]) {
      queueFlashMentoringTalentReview_('MATCHES', matchId, 'PULSE_DUPLICATE_FOR_MATCH');
      pulsesByMatch[matchId] = null;
      return;
    }
    if (pulsesByMatch[matchId] === null) return;
    var reflectionRating = normalizeFlashMentoringReportRating_(pulse.reflectionRating);
    var matchFitRating = normalizeFlashMentoringReportRating_(pulse.matchFitRating);
    if (reflectionRating == null || matchFitRating == null) {
      queueFlashMentoringTalentReview_('PULSE', pulse.pulseId, 'PULSE_RATING_INVALID');
      return;
    }
    pulsesByMatch[matchId] = {
      reflectionRating: reflectionRating,
      matchFitRating: matchFitRating
    };
  });

  var validPulses = Object.keys(pulsesByMatch).map(function(matchId) {
    return pulsesByMatch[matchId];
  }).filter(function(pulse) { return !!pulse; });
  var reflectionTotal = validPulses.reduce(function(total, pulse) {
    return total + pulse.reflectionRating;
  }, 0);
  var matchFitTotal = validPulses.reduce(function(total, pulse) {
    return total + pulse.matchFitRating;
  }, 0);

  return {
    periodLabel: 'Acumulado total',
    generatedAt: new Date().toISOString(),
    registeredMentors: activeMentors.length,
    requestsReceived: scopedRequests.length,
    realizationRate: {
      realizedCount: realizedCount,
      acceptedCount: acceptedCount,
      percentage: acceptedCount ? roundFlashMentoringMetric_(realizedCount * 100 / acceptedCount) : null
    },
    menteeExperience: {
      reflectionAverage: validPulses.length
        ? roundFlashMentoringMetric_(reflectionTotal / validPulses.length)
        : null,
      matchFitAverage: validPulses.length
        ? roundFlashMentoringMetric_(matchFitTotal / validPulses.length)
        : null,
      responses: validPulses.length
    }
  };
}

function normalizeFlashMentoringReportRating_(value) {
  var number = typeof value === 'number' ? value : Number(String(value == null ? '' : value).trim());
  if (!isFinite(number) || Math.floor(number) !== number || number < 1 || number > 5) return null;
  return number;
}

function roundFlashMentoringMetric_(value) {
  return Math.round(Number(value) * 100) / 100;
}
