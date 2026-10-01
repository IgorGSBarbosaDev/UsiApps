var FLASH_MENTORING_PULSE_SETTINGS = Object.freeze({
  recommendationScale: 'PULSE_RECOMMENDATION_SCALE'
});

function getFlashMentoringRecommendationScale_(repositories) {
  repositories = repositories || getFlashMentoringRepositories_();
  var setting = repositories.SETTINGS.listAll().filter(function(record) {
    return String(record.settingKey) === FLASH_MENTORING_PULSE_SETTINGS.recommendationScale;
  })[0];
  if (!setting || !String(setting.settingValue || '').trim()) {
    queueFlashMentoringTalentReview_('SETTINGS', FLASH_MENTORING_PULSE_SETTINGS.recommendationScale,
      'PULSE_RECOMMENDATION_SCALE_CONFIGURATION_REQUIRED');
    return { configured: false, pending: true, values: [] };
  }

  try {
    var values = JSON.parse(String(setting.settingValue));
    if (!Array.isArray(values) || !values.length || values.length > 12) {
      queueFlashMentoringTalentReview_('SETTINGS', FLASH_MENTORING_PULSE_SETTINGS.recommendationScale,
        'PULSE_RECOMMENDATION_SCALE_CONFIGURATION_INVALID');
      return { configured: false, pending: true, values: [] };
    }
    var normalized = values.map(function(value) {
      return String(value == null ? '' : value).trim();
    });
    if (normalized.some(function(value) { return !value || value.length > 50; })) {
      queueFlashMentoringTalentReview_('SETTINGS', FLASH_MENTORING_PULSE_SETTINGS.recommendationScale,
        'PULSE_RECOMMENDATION_SCALE_CONFIGURATION_INVALID');
      return { configured: false, pending: true, values: [] };
    }
    return { configured: true, pending: false, values: normalized };
  } catch (error) {
    queueFlashMentoringTalentReview_('SETTINGS', FLASH_MENTORING_PULSE_SETTINGS.recommendationScale,
      'PULSE_RECOMMENDATION_SCALE_CONFIGURATION_INVALID');
    return { configured: false, pending: true, values: [] };
  }
}

function submitFlashMentoringPulse_(actor, payload) {
  actor = requireVerifiedFlashMentoringActor_(actor);
  if (!hasFlashMentoringRole_(actor, 'MENTORADO')) {
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }
  payload = payload || {};
  var matchId = normalizeFlashMentoringPulseText_(payload.matchId, 120);
  if (!matchId) throw createFlashMentoringServiceError_('MATCH_ID_REQUIRED');

  var reflectionRating = normalizeFlashMentoringPulseRating_(payload.reflectionRating);
  var matchFitRating = normalizeFlashMentoringPulseRating_(payload.matchFitRating);
  if (reflectionRating == null || matchFitRating == null) {
    throw createFlashMentoringServiceError_('PULSE_RATING_INVALID');
  }
  var comment = normalizeFlashMentoringPulseText_(payload.comment, 2000);
  var repositories = getFlashMentoringRepositories_();
  var match = repositories.MATCHES.listAll().filter(function(record) {
    return String(record.matchId) === matchId;
  })[0];
  if (!match || String(match.menteePersonId) !== String(actor.personId)) {
    throw createFlashMentoringServiceError_('MATCH_NOT_FOUND');
  }
  if (String(match.status) !== FLASH_MENTORING_MATCH_STATUSES.REALIZED) {
    throw createFlashMentoringServiceError_('PULSE_AVAILABLE_AFTER_REALIZED_MATCH');
  }

  var scale = getFlashMentoringRecommendationScale_(repositories);
  var recommendationAnswer = normalizeFlashMentoringPulseText_(payload.recommendationAnswer, 50);
  if (!scale.configured && recommendationAnswer) {
    throw createFlashMentoringServiceError_('PULSE_RECOMMENDATION_SCALE_PENDING');
  }
  if (scale.configured && recommendationAnswer && scale.values.indexOf(recommendationAnswer) < 0) {
    throw createFlashMentoringServiceError_('PULSE_RECOMMENDATION_ANSWER_INVALID');
  }
  if (scale.configured && !recommendationAnswer) {
    throw createFlashMentoringServiceError_('PULSE_RECOMMENDATION_ANSWER_REQUIRED');
  }

  var pulseId = flashMentoringStableId_('pulse', [matchId]);
  var existing = repositories.PULSE.listAll().filter(function(record) {
    return String(record.pulseId) === pulseId;
  })[0];
  if (existing) return { pulseId: pulseId, submittedAt: existing.submittedAt, alreadySubmitted: true };

  var pulse = {
    pulseId: pulseId,
    matchId: matchId,
    menteePersonId: String(actor.personId),
    reflectionRating: reflectionRating,
    matchFitRating: matchFitRating,
    recommendationAnswer: recommendationAnswer,
    comment: comment,
    submittedAt: new Date().toISOString()
  };
  try {
    repositories.PULSE.appendMany([pulse]);
  } catch (error) {
    var afterRace = repositories.PULSE.listAll().filter(function(record) {
      return String(record.pulseId) === pulseId;
    })[0];
    if (afterRace) return { pulseId: pulseId, submittedAt: afterRace.submittedAt, alreadySubmitted: true };
    throw createFlashMentoringServiceError_('PULSE_SAVE_FAILED');
  }

  recordFlashMentoringAudit_(actor.personId, 'PULSE_SUBMITTED', 'MATCHES', matchId, {
    reflectionRating: reflectionRating,
    matchFitRating: matchFitRating,
    scaleConfigured: scale.configured
  }, 'PULSE_SUBMITTED:' + pulseId);
  return { pulseId: pulseId, submittedAt: pulse.submittedAt, alreadySubmitted: false };
}

function normalizeFlashMentoringPulseRating_(value) {
  var rating = typeof value === 'number' ? value : Number(value);
  if (!isFinite(rating) || Math.floor(rating) !== rating || rating < 1 || rating > 5) return null;
  return rating;
}

function normalizeFlashMentoringPulseText_(value, maxLength) {
  if (value == null) return '';
  if (typeof value !== 'string') throw createFlashMentoringServiceError_('PULSE_TEXT_INVALID');
  var normalized = value.trim();
  if (normalized.length > maxLength) throw createFlashMentoringServiceError_('PULSE_TEXT_TOO_LONG');
  return normalized;
}
