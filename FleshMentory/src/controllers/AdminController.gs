/**
 * Contratos esperados pelo painel:
 *
 * AccessService.requireFlashMentoringAccess_(roleCodes)
 *   -> principal { personId, displayName, roles, ... }; lanca FORBIDDEN sem acesso.
 *
 * Services (funcoes globais):
 *   getFlashMentoringAdminBootstrap_(principal)
 *     -> { statusOptions: [{ code, label, count }], mentors: [mentor DTO] }
 *   listFlashMentoringRequestsForAdmin_(principal, { status, search, page, pageSize })
 *     -> { items: [request summary], page, pageSize, total }
 *   getFlashMentoringRequestForAdmin_(principal, requestId)
 *     -> request detail com shortlist ordenada
 *   reviewFlashMentoringRequest_(principal,
 *     { requestId, action, approvedCandidateIds? })
 *     -> { requestId, status, statusLabel }
 *   reviewFlashMentoringMentor_(principal, { mentorPersonId, action })
 *     -> { mentorPersonId, status, statusLabel }
 *   getFlashMentoringMetrics_(principal) -> os quatro indicadores oficiais.
 *
 * Services também verificam escopo por solicitacao/representante de RH,
 * aplicam matching, persistencia, auditoria e efeitos colaterais.
 * ESCALATE_TO_TALENT deve apenas encaminhar
 * para revisão humana, sem notificar negativamente o mentorado. REGENERATE
 * sem opcoes ou diante de falha/inconsistência tambem deve encaminhar a Talent.
 * Os DTOs devolvidos ao navegador sao projetados por allowlist neste controller.
 */
var ADMIN_REVIEW_ROLES_ = Object.freeze(['RH', 'TALENT']);
var ADMIN_MENTOR_REVIEW_ROLES_ = Object.freeze(['TALENT']);
var ADMIN_MAX_LIST_PAGE_SIZE_ = 50;

function adminGetBootstrap() {
  return adminEndpoint_(ADMIN_REVIEW_ROLES_, function(principal) {
    var source = adminCallService_(
      typeof getFlashMentoringAdminBootstrap_ === 'function' ? getFlashMentoringAdminBootstrap_ : null,
      [principal]
    );
    var statusOptions = Array.isArray(source.statusOptions)
      ? source.statusOptions.slice(0, 30).map(adminProjectStatusOption_)
      : [];
    var mentors = Array.isArray(source.mentors)
      ? source.mentors.map(adminProjectMentor_)
      : [];
    return {
      displayName: adminText_(principal.displayName, 100),
      statusOptions: statusOptions,
      mentors: mentors
    };
  });
}

function adminListRequests(payload) {
  return adminEndpoint_(ADMIN_REVIEW_ROLES_, function(principal) {
    var filters = adminValidateListPayload_(payload);
    var source = adminCallService_(
      typeof listFlashMentoringRequestsForAdmin_ === 'function' ? listFlashMentoringRequestsForAdmin_ : null,
      [principal, filters]
    );
    if (!adminIsRecord_(source) || !Array.isArray(source.items)) {
      throw adminControllerError_('INTERNAL_ERROR', 'Resposta do painel inválida.');
    }
    return {
      items: source.items.slice(0, filters.pageSize).map(adminProjectRequestSummary_),
      page: adminIntegerOrNull_(source.page) || filters.page,
      pageSize: adminIntegerOrNull_(source.pageSize) || filters.pageSize,
      total: adminIntegerOrNull_(source.total)
    };
  });
}

function adminGetRequest(requestId) {
  return adminEndpoint_(ADMIN_REVIEW_ROLES_, function(principal) {
    var id = adminRequiredId_(requestId, 'requestId');
    var source = adminCallService_(
      typeof getFlashMentoringRequestForAdmin_ === 'function' ? getFlashMentoringRequestForAdmin_ : null,
      [principal, id]
    );
    return adminProjectRequestDetail_(source);
  });
}

function adminReviewRequest(payload) {
  return adminEndpoint_(ADMIN_REVIEW_ROLES_, function(principal) {
    var review = adminValidateRequestReview_(payload);
    var servicePayload = { requestId: review.requestId, action: review.action };
    if (review.candidateIds) servicePayload.approvedCandidateIds = review.candidateIds.slice();
    var source = adminCallService_(
      typeof reviewFlashMentoringRequest_ === 'function' ? reviewFlashMentoringRequest_ : null,
      [principal, servicePayload]
    );
    return adminProjectActionResult_(source, 'requestId', 'requestId');
  });
}

function adminReviewMentor(payload) {
  return adminEndpoint_(ADMIN_MENTOR_REVIEW_ROLES_, function(principal) {
    var review = adminValidateMentorReview_(payload);
    var source = adminCallService_(
      typeof reviewFlashMentoringMentor_ === 'function' ? reviewFlashMentoringMentor_ : null,
      [principal, { mentorPersonId: review.mentorId, action: review.action }]
    );
    return adminProjectActionResult_(source, 'mentorPersonId', 'mentorId');
  });
}

function adminGetMetrics() {
  return adminEndpoint_(ADMIN_REVIEW_ROLES_, function(principal) {
    return adminProjectMetrics_(adminCallService_(
      typeof getFlashMentoringMetrics_ === 'function' ? getFlashMentoringMetrics_ : null,
      [principal]
    ));
  });
}

function adminEndpoint_(roleCodes, callback) {
  try {
    var principal = adminRequirePrincipal_(roleCodes);
    return { ok: true, data: callback(principal) };
  } catch (error) {
    return { ok: false, error: adminPublicError_(error) };
  }
}

function adminRequirePrincipal_(roleCodes) {
  if (typeof AccessService === 'undefined' ||
      !AccessService ||
      typeof AccessService.requireFlashMentoringAccess_ !== 'function') {
    throw adminControllerError_(
      'SERVICE_UNAVAILABLE',
      'Não foi possível validar o acesso ao painel agora.'
    );
  }

  var principal;
  try {
    principal = AccessService.requireFlashMentoringAccess_(roleCodes.slice());
  } catch (error) {
    if (error && String(error.code || '').toUpperCase() === 'FORBIDDEN') {
      throw adminControllerError_('FORBIDDEN', 'Você não tem permissão para esta operação.');
    }
    throw error;
  }

  if (!adminIsRecord_(principal) || !adminRequiredIdValue_(principal.personId)) {
    throw adminControllerError_('FORBIDDEN', 'Não foi possível validar seu acesso ao painel.');
  }
  return principal;
}

function adminCallService_(serviceFunction, args) {
  if (typeof serviceFunction !== 'function') {
    throw adminControllerError_(
      'SERVICE_UNAVAILABLE',
      'O painel não está disponível no momento.'
    );
  }
  return serviceFunction.apply(null, args);
}

function adminValidateListPayload_(payload) {
  var value = payload == null ? {} : payload;
  adminAssertKnownFields_(value, ['status', 'search', 'page', 'pageSize']);

  var status = 'ALL';
  if (value.status != null && value.status !== '') {
    status = adminText_(value.status, 40).toUpperCase();
    if (status !== 'ALL' && !/^[A-Z][A-Z0-9_]{0,39}$/.test(status)) {
      throw adminControllerError_('INVALID_ARGUMENT', 'Filtro de status inválido.');
    }
  }

  var search = '';
  if (value.search != null) {
    if (typeof value.search !== 'string' || value.search.length > 100) {
      throw adminControllerError_('INVALID_ARGUMENT', 'A busca deve ter até 100 caracteres.');
    }
    search = value.search.trim();
  }

  var page = value.page == null ? 1 : value.page;
  var pageSize = value.pageSize == null ? 20 : value.pageSize;
  if (!adminIsInteger_(page) || page < 1 || page > 10000) {
    throw adminControllerError_('INVALID_ARGUMENT', 'Página inválida.');
  }
  if (!adminIsInteger_(pageSize) || pageSize < 10 || pageSize > ADMIN_MAX_LIST_PAGE_SIZE_) {
    throw adminControllerError_('INVALID_ARGUMENT', 'Tamanho de página inválido.');
  }
  return { status: status, search: search, page: page, pageSize: pageSize };
}

function adminValidateRequestReview_(payload) {
  adminAssertKnownFields_(payload, ['requestId', 'action', 'candidateIds']);
  var requestId = adminRequiredId_(payload.requestId, 'requestId');
  var action = adminRequiredEnum_(payload.action, ['APPROVE', 'REGENERATE', 'ESCALATE_TO_TALENT']);
  var result = { requestId: requestId, action: action };

  if (action === 'APPROVE') {
    if (!Array.isArray(payload.candidateIds) ||
        payload.candidateIds.length < 1 ||
        payload.candidateIds.length > 3) {
      throw adminControllerError_('INVALID_ARGUMENT', 'A ordem aprovada deve conter de 1 a 3 opções.');
    }
    var seen = Object.create(null);
    result.candidateIds = [];
    for (var index = 0; index < payload.candidateIds.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(payload.candidateIds, index)) {
        throw adminControllerError_('INVALID_ARGUMENT', 'A ordem aprovada contém uma opção inválida.');
      }
      var id = adminRequiredId_(payload.candidateIds[index], 'candidateId');
      if (seen[id]) {
        throw adminControllerError_('INVALID_ARGUMENT', 'A shortlist não pode repetir uma opção.');
      }
      seen[id] = true;
      result.candidateIds.push(id);
    }
  } else if (Object.prototype.hasOwnProperty.call(payload, 'candidateIds')) {
    throw adminControllerError_('INVALID_ARGUMENT', 'candidateIds só é permitido ao aprovar a ordem.');
  }
  return result;
}

function adminValidateMentorReview_(payload) {
  adminAssertKnownFields_(payload, ['mentorId', 'action']);
  return {
    mentorId: adminRequiredId_(payload.mentorId, 'mentorId'),
    action: adminRequiredEnum_(payload.action, ['APPROVE', 'PAUSE', 'REACTIVATE'])
  };
}

function adminAssertKnownFields_(value, allowedFields) {
  if (!adminIsRecord_(value)) {
    throw adminControllerError_('INVALID_ARGUMENT', 'Payload inválido.');
  }
  var allowed = Object.create(null);
  allowedFields.forEach(function(field) { allowed[field] = true; });
  Object.keys(value).forEach(function(field) {
    if (!allowed[field]) {
      throw adminControllerError_('INVALID_ARGUMENT', 'O payload contém um campo não permitido.');
    }
  });
}

function adminRequiredId_(value, fieldName) {
  var id = adminRequiredIdValue_(value);
  if (!id) {
    throw adminControllerError_('INVALID_ARGUMENT', 'Identificador inválido: ' + fieldName + '.');
  }
  return id;
}

function adminRequiredIdValue_(value) {
  if (typeof value !== 'string') return '';
  var id = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(id) ? id : '';
}

function adminRequiredEnum_(value, allowedValues) {
  if (typeof value !== 'string') {
    throw adminControllerError_('INVALID_ARGUMENT', 'Ação inválida.');
  }
  var normalized = value.trim().toUpperCase();
  if (allowedValues.indexOf(normalized) === -1) {
    throw adminControllerError_('INVALID_ARGUMENT', 'Ação inválida.');
  }
  return normalized;
}

function adminProjectStatusOption_(source) {
  if (!adminIsRecord_(source)) return { code: '', label: '', count: null };
  return {
    code: adminStatusCode_(source.code),
    label: adminText_(source.label, 60),
    count: adminNonNegativeNumberOrNull_(source.count)
  };
}

function adminProjectRequestSummary_(source) {
  if (!adminIsRecord_(source)) source = {};
  return {
    requestId: adminSafeIdForOutput_(source.requestId),
    status: adminStatusCode_(source.status),
    statusLabel: adminText_(source.statusLabel, 60),
    topicCategory: adminText_(source.topicCategory, 80),
    topicName: adminText_(source.topicName, 120),
    menteeName: adminText_(source.menteeName, 120),
    menteeJobTitle: adminText_(source.menteeJobTitle, 120),
    menteeArea: adminText_(source.menteeArea, 100),
    menteeUnit: adminText_(source.menteeUnit, 100),
    submittedAt: adminText_(source.submittedAt, 50)
  };
}

function adminProjectRequestDetail_(source) {
  if (!adminIsRecord_(source)) {
    throw adminControllerError_('INTERNAL_ERROR', 'Detalhe de solicitação inválido.');
  }
  var mentee = adminIsRecord_(source.mentee) ? source.mentee : {};
  var candidates = Array.isArray(source.candidates) ? source.candidates : [];
  return {
    requestId: adminSafeIdForOutput_(source.requestId),
    status: adminStatusCode_(source.status),
    statusLabel: adminText_(source.statusLabel, 60),
    topicCategory: adminText_(source.topicCategory, 80),
    topicName: adminText_(source.topicName, 120),
    challengeSummary: adminText_(source.challengeSummary, 1200),
    desiredOutcome: adminText_(source.desiredOutcome, 800),
    submittedAt: adminText_(source.submittedAt, 50),
    mentee: {
      displayName: adminText_(mentee.displayName, 120),
      jobTitle: adminText_(mentee.jobTitle, 120),
      area: adminText_(mentee.area, 100),
      unit: adminText_(mentee.unit, 100),
      audience: adminText_(mentee.audience, 80),
      managerDisplayName: adminText_(mentee.managerDisplayName, 120)
    },
    candidates: candidates.slice(0, 3).map(adminProjectCandidate_)
  };
}

function adminProjectCandidate_(source, index) {
  if (!adminIsRecord_(source)) source = {};
  return {
    candidateId: adminSafeIdForOutput_(source.candidateId),
    order: adminPositiveIntegerOrFallback_(source.order, index + 1),
    displayName: adminText_(source.displayName, 120),
    jobTitle: adminText_(source.jobTitle, 120),
    area: adminText_(source.area, 100),
    unit: adminText_(source.unit, 100),
    cluster: adminText_(source.cluster, 40),
    availableSlots: adminNonNegativeNumberOrNull_(source.availableSlots),
    rationale: adminText_(source.rationale, 800)
  };
}

function adminProjectMentor_(source) {
  if (!adminIsRecord_(source)) source = {};
  var topics = Array.isArray(source.topics)
    ? source.topics.slice(0, 5).map(function(value) { return adminText_(value, 100); })
    : [];
  return {
    mentorId: adminSafeIdForOutput_(source.mentorId || source.mentorPersonId || source.personId),
    displayName: adminText_(source.displayName, 120),
    jobTitle: adminText_(source.jobTitle, 120),
    area: adminText_(source.area, 100),
    unit: adminText_(source.unit, 100),
    status: adminStatusCode_(source.status),
    topics: topics,
    experienceSummary: adminText_(source.experienceSummary, 800),
    capacityLimit: adminNonNegativeNumberOrNull_(source.capacityLimit),
    activeConnections: adminNonNegativeNumberOrNull_(source.activeConnections),
    availableSlots: adminNonNegativeNumberOrNull_(source.availableSlots),
    updatedAt: adminText_(source.updatedAt, 50)
  };
}

function adminProjectActionResult_(source, sourceIdField, outputIdField) {
  if (!adminIsRecord_(source)) {
    throw adminControllerError_('INTERNAL_ERROR', 'Resposta de ação inválida.');
  }
  var result = {};
  result[outputIdField] = adminSafeIdForOutput_(source[sourceIdField]);
  result.status = adminStatusCode_(source.status);
  result.statusLabel = adminText_(source.statusLabel, 60);
  return result;
}

function adminProjectMetrics_(source) {
  if (!adminIsRecord_(source)) {
    throw adminControllerError_('INTERNAL_ERROR', 'Resposta de indicadores inválida.');
  }
  var rate = adminIsRecord_(source.realizationRate) ? source.realizationRate : {};
  var experience = adminIsRecord_(source.menteeExperience) ? source.menteeExperience : {};
  return {
    periodLabel: adminText_(source.periodLabel, 100),
    generatedAt: adminText_(source.generatedAt, 50),
    registeredMentors: adminNonNegativeNumberOrNull_(source.registeredMentors),
    requestsReceived: adminNonNegativeNumberOrNull_(source.requestsReceived),
    realizationRate: {
      realizedCount: adminNonNegativeNumberOrNull_(rate.realizedCount),
      acceptedCount: adminNonNegativeNumberOrNull_(rate.acceptedCount),
      percentage: adminBoundedNumberOrNull_(rate.percentage, 0, 100)
    },
    menteeExperience: {
      reflectionAverage: adminBoundedNumberOrNull_(experience.reflectionAverage, 1, 5),
      matchFitAverage: adminBoundedNumberOrNull_(experience.matchFitAverage, 1, 5),
      responses: adminNonNegativeNumberOrNull_(experience.responses)
    }
  };
}

function adminStatusCode_(value) {
  var status = adminText_(value, 40).toUpperCase();
  return /^[A-Z][A-Z0-9_]{0,39}$/.test(status) ? status : '';
}

function adminSafeIdForOutput_(value) {
  return adminRequiredIdValue_(typeof value === 'string' ? value : '');
}

function adminText_(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function adminIsRecord_(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  var prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function adminIsInteger_(value) {
  return typeof value === 'number' && isFinite(value) && Math.floor(value) === value;
}

function adminIntegerOrNull_(value) {
  return adminIsInteger_(value) && value >= 0 ? value : null;
}

function adminPositiveIntegerOrFallback_(value, fallback) {
  return adminIsInteger_(value) && value > 0 ? value : fallback;
}

function adminNonNegativeNumberOrNull_(value) {
  return typeof value === 'number' && isFinite(value) && value >= 0 ? value : null;
}

function adminBoundedNumberOrNull_(value, minimum, maximum) {
  return typeof value === 'number' && isFinite(value) && value >= minimum && value <= maximum
    ? value
    : null;
}

function adminControllerError_(code, message) {
  var error = new Error(message);
  error.name = 'AdminControllerError';
  error.code = code;
  return error;
}

function adminPublicError_(error) {
  var code = error && typeof error.code === 'string' ? error.code.toUpperCase() : '';
  if (error && error.name === 'AdminControllerError') {
    return { code: code || 'INTERNAL_ERROR', message: error.message };
  }
  if (code === 'FORBIDDEN' || code === 'ACCESS_DENIED') {
    return { code: 'FORBIDDEN', message: 'Você não tem permissão para esta operação.' };
  }
  if (code === 'NOT_FOUND') {
    return { code: 'NOT_FOUND', message: 'O registro solicitado não foi encontrado.' };
  }
  if (code === 'CONFLICT') {
    return { code: 'CONFLICT', message: 'O registro mudou. Atualize a tela antes de tentar novamente.' };
  }
  if (code === 'INVALID_ARGUMENT') {
    return { code: 'INVALID_ARGUMENT', message: 'Revise os dados informados e tente novamente.' };
  }
  if (code === 'SERVICE_UNAVAILABLE') {
    return { code: 'SERVICE_UNAVAILABLE', message: 'O serviço está indisponível no momento.' };
  }
  return { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação.' };
}