/**
 * Portal endpoints. Identity always comes from the Apps Script server session;
 * client payloads are rebuilt from an allowlist and never supply actor identity.
 *
 * Expected service factory (implemented outside this controller):
 * getFlashMentoringPortalService_() returns methods:
 *   resolveSessionActor(sessionEmail) -> {status: 'OK', actor: {personId, roles, ...}}
 *      or {status: 'NOT_FOUND'|'CONFLICT'|...}; actor is resolved from trusted data.
 *   routeTalentException({reasonCode, sessionEmail}) -> {routed: true|false}
 *   getBootstrap(actor) -> {viewer, capabilities, topicCatalog, mentorProfile,
 *      pulseRecommendationOptions}; no email/personId. mentorProfile.hasProfile
 *      determines whether the UI uses submit/update.
 *   submitMentorProfile(actor, payload), updateMentorProfile(actor, payload)
 *   submitRequest(actor, payload), getMyRequests(actor) ->
 *      {menteeRequests, mentorInvites, matches}; each collection is actor-filtered.
 *      Pre-acceptance mentorInvites expose the topic/status and candidateId only;
 *      a match DTO may carry the briefing after acceptance.
 *   respondToInvite(actor, candidateId, action) // ACCEPT or DECLINE only.
 *   recordNextMonthAvailability(actor, candidateId) // pending only; no Match/slot.
 *   updateMatchProgress(actor, {matchId, progressType, value, scheduledAt?});
 *   submitPulse(actor, {matchId, reflectionRating, matchFitRating,
 *      recommendationAnswer?, comment?}).
 * Every service must authorize actor ownership/role and return only data that
 * actor may see. submitRequest verifies profile confirmation, eligibility,
 * single-topic scope and consent; exceptions go to Talent without a negative
 * automatic decision. Mentor profile intake stays pending Talent curation.
 * Only ACCEPT may create a Match and consume capacity. updateMatchProgress
 * enforces valid state transitions and releases capacity at closure; submitPulse
 * allows only the mentee of a closed Match. AVAILABLE_NEXT_MONTH must never
 * create a Match or consume capacity.
 */

function portalGetBootstrap() {
  return portalInvokeService_('getBootstrap', []);
}

function portalSubmitMentorProfile(payload) {
  return portalInvokeService_('submitMentorProfile', [portalMentorProfilePayload_(payload)]);
}

function portalUpdateMentorProfile(payload) {
  return portalInvokeService_('updateMentorProfile', [portalMentorProfilePayload_(payload)]);
}

function portalSubmitRequest(payload) {
  return portalInvokeService_('submitRequest', [portalRequestPayload_(payload)]);
}

function portalGetMyRequests() {
  return portalInvokeService_('getMyRequests', []);
}

function portalRespondToInvite(payload) {
  var source = portalObjectPayload_(payload);
  var candidateId = portalRequiredString_(source.candidateId, 'convite', 160);
  var action = portalEnum_(source.action, [
    'ACCEPT', 'DECLINE', 'AVAILABLE_NEXT_MONTH'
  ], 'resposta');

  // This path is deliberately separate: it can only record a pending state.
  if (action === 'AVAILABLE_NEXT_MONTH') {
    return portalInvokeService_('recordNextMonthAvailability', [candidateId]);
  }
  return portalInvokeService_('respondToInvite', [candidateId, action]);
}

function portalUpdateMatchProgress(payload) {
  var source = portalObjectPayload_(payload);
  var progressType = portalEnum_(source.progressType, ['SCHEDULING', 'OUTCOME'], 'tipo de atualização');
  var value = portalEnum_(source.value, [
    'SCHEDULED', 'STILL_COORDINATING', 'UNABLE_TO_CONTACT',
    'REALIZED', 'RESCHEDULED', 'CANCELLED', 'NOT_REALIZED'
  ], 'status');

  var allowedValues = progressType === 'SCHEDULING'
    ? ['SCHEDULED', 'STILL_COORDINATING', 'UNABLE_TO_CONTACT']
    : ['REALIZED', 'RESCHEDULED', 'CANCELLED', 'NOT_REALIZED'];
  if (allowedValues.indexOf(value) === -1) {
    throw new Error('O status não corresponde à etapa selecionada.');
  }

  var requiresDate = (progressType === 'SCHEDULING' && value === 'SCHEDULED') ||
    (progressType === 'OUTCOME' && value === 'RESCHEDULED');
  var scheduledAt = requiresDate ? portalRequiredDate_(source.scheduledAt) : '';
  return portalInvokeService_('updateMatchProgress', [{
    matchId: portalRequiredString_(source.matchId, 'conexão', 160),
    progressType: progressType,
    value: value,
    scheduledAt: scheduledAt
  }]);
}

function portalSubmitPulse(payload) {
  var source = portalObjectPayload_(payload);
  return portalInvokeService_('submitPulse', [{
    matchId: portalRequiredString_(source.matchId, 'conexão', 160),
    reflectionRating: portalScalar_(source.reflectionRating, 20),
    matchFitRating: portalScalar_(source.matchFitRating, 20),
    recommendationAnswer: portalScalar_(source.recommendationAnswer, 120),
    comment: portalOptionalString_(source.comment, 2000)
  }]);
}

function portalInvokeService_(methodName, methodArgs) {
  var context = portalRequireActor_();
  var handler = context.service[methodName];
  if (typeof handler !== 'function') {
    throw new Error('Portal temporariamente indisponível. Talent precisa concluir a configuração.');
  }

  try {
    return handler.apply(context.service, [context.actor].concat(methodArgs));
  } catch (error) {
    portalTryRouteException_(context.service, 'PORTAL_OPERATION_FAILED', context.sessionEmail);
    throw new Error('Não foi possível concluir agora. O caso precisa de validação de Talent.');
  }
}

function portalRequireActor_() {
  var service = portalGetService_();
  var sessionEmail = '';
  try {
    // The manifest must authorize userinfo.email; if deployment policy hides
    // the active user's address, this endpoint deliberately fails closed.
    sessionEmail = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (error) {
    sessionEmail = '';
  }

  if (!sessionEmail) {
    portalFailIdentity_(service, 'SESSION_IDENTITY_UNAVAILABLE', sessionEmail);
  }
  if (typeof service.resolveSessionActor !== 'function') {
    throw new Error('Portal temporariamente indisponível. Talent precisa concluir a configuração.');
  }

  var resolution;
  try {
    resolution = service.resolveSessionActor(sessionEmail);
  } catch (error) {
    portalFailIdentity_(service, 'IDENTITY_RESOLUTION_FAILED', sessionEmail);
  }

  var actor = resolution && resolution.actor;
  if (!resolution || resolution.status !== 'OK' || !actor ||
      !String(actor.personId || '').trim()) {
    var reason = resolution && resolution.status === 'CONFLICT'
      ? 'IDENTITY_CONFLICT'
      : 'IDENTITY_NOT_RESOLVED';
    portalFailIdentity_(service, reason, sessionEmail);
  }

  return { service: service, actor: actor, sessionEmail: sessionEmail };
}

function portalGetService_() {
  if (typeof getFlashMentoringPortalService_ !== 'function') {
    throw new Error('Portal temporariamente indisponível. Talent precisa concluir a configuração.');
  }
  var service = getFlashMentoringPortalService_();
  if (!service || typeof service !== 'object') {
    throw new Error('Portal temporariamente indisponível. Talent precisa concluir a configuração.');
  }
  return service;
}

function portalFailIdentity_(service, reasonCode, sessionEmail) {
  var routed = portalTryRouteException_(service, reasonCode, sessionEmail);
  if (routed) {
    throw new Error('Não foi possível validar sua identidade. O caso foi encaminhado para Talent.');
  }
  throw new Error('Não foi possível validar sua identidade. Procure Talent para conferência.');
}

function portalTryRouteException_(service, reasonCode, sessionEmail) {
  if (!service || typeof service.routeTalentException !== 'function') return false;
  try {
    var result = service.routeTalentException({
      reasonCode: reasonCode,
      sessionEmail: sessionEmail || ''
    });
    return result === true || Boolean(result && result.routed === true);
  } catch (error) {
    return false;
  }
}

function portalMentorProfilePayload_(payload) {
  var source = portalObjectPayload_(payload);
  var topics = source.topics;
  if (!Array.isArray(topics)) topics = [];
  if (topics.length > 25) throw new Error('Revise os temas selecionados e tente novamente.');

  return {
    topics: topics.map(function(topic) {
      var item = portalObjectPayload_(topic);
      return {
        category: portalOptionalString_(item.category, 160),
        topicName: portalOptionalString_(item.topicName, 240)
      };
    }),
    experienceSummary: portalOptionalString_(source.experienceSummary, 3000),
    capacityLimit: portalScalar_(source.capacityLimit, 8),
    principlesAcknowledged: source.principlesAcknowledged === true
  };
}

function portalRequestPayload_(payload) {
  var source = portalObjectPayload_(payload);
  return {
    profileConfirmed: source.profileConfirmed === true,
    topicCategory: portalOptionalString_(source.topicCategory, 160),
    topicName: portalOptionalString_(source.topicName, 240),
    challengeSummary: portalOptionalString_(source.challengeSummary, 1200),
    desiredOutcome: portalOptionalString_(source.desiredOutcome, 1200),
    principlesAcknowledged: source.principlesAcknowledged === true
  };
}

function portalObjectPayload_(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Os dados enviados não puderam ser conferidos.');
  }
  return payload;
}

function portalRequiredString_(value, fieldLabel, maxLength) {
  var result = portalOptionalString_(value, maxLength);
  if (!result) throw new Error('Informe a referência de ' + fieldLabel + '.');
  return result;
}

function portalOptionalString_(value, maxLength) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Há um campo em formato inválido.');
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}

function portalRequiredDate_(value) {
  if (typeof value !== 'string') throw new Error('Informe a data combinada para continuar.');
  var result = value.trim();
  if (!result) throw new Error('Informe a data combinada para continuar.');
  var parts = result.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!parts) throw new Error('Informe uma data válida.');
  var year = Number(parts[1]);
  var month = Number(parts[2]);
  var day = Number(parts[3]);
  var date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day) {
    throw new Error('Informe uma data válida.');
  }
  return result;
}

function portalScalar_(value, maxLength) {
  if (typeof value === 'number' && isFinite(value)) return value;
  if (typeof value === 'string') return portalOptionalString_(value, maxLength);
  return '';
}

function portalEnum_(value, allowedValues, fieldLabel) {
  if (typeof value !== 'string') throw new Error('O campo ' + fieldLabel + ' é inválido.');
  var normalized = value.trim().toUpperCase();
  if (allowedValues.indexOf(normalized) === -1) {
    throw new Error('O campo ' + fieldLabel + ' é inválido.');
  }
  return normalized;
}
