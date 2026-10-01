function requireFlashMentoringAccess_(requiredRoles) {
  var rolesToRequire = normalizeFlashMentoringRequiredRoles_(requiredRoles);
  var sessionEmail = '';
  try {
    sessionEmail = normalizeFlashMentoringEmail_(Session.getActiveUser().getEmail());
  } catch (error) {
    recordFlashMentoringAccessConfigurationReview_('SESSION_IDENTITY_UNAVAILABLE', '');
    throw createFlashMentoringServiceError_('ACCESS_IDENTITY_UNVERIFIED');
  }
  if (!sessionEmail) {
    recordFlashMentoringAccessConfigurationReview_('SESSION_EMAIL_UNAVAILABLE', '');
    throw createFlashMentoringServiceError_('ACCESS_IDENTITY_UNVERIFIED');
  }

  var repositories;
  var personMatches;
  var activeRoles;
  try {
    repositories = getFlashMentoringRepositories_();
    personMatches = repositories.PEOPLE_MASTER.listAll().filter(function(person) {
      return normalizeFlashMentoringEmail_(person.corporateEmail) === sessionEmail;
    });
    if (personMatches.length !== 1 || !personMatches[0].personId) {
      recordFlashMentoringAccessConfigurationReview_(
        personMatches.length > 1 ? 'IDENTITY_MAPPING_AMBIGUOUS' : 'IDENTITY_NOT_IN_PEOPLE_MASTER',
        sessionEmail
      );
      throw createFlashMentoringServiceError_('ACCESS_IDENTITY_UNVERIFIED');
    }

    var personId = String(personMatches[0].personId).trim();
    activeRoles = repositories.ACCESS_ROLES.listAll().filter(function(assignment) {
      return String(assignment.personId) === personId
        && !hasFlashMentoringValue_(assignment.revokedAt);
    });
  } catch (error) {
    if (error && error.code === 'ACCESS_IDENTITY_UNVERIFIED') throw error;
    recordFlashMentoringAccessConfigurationReview_('IDENTITY_DATA_SOURCE_UNAVAILABLE', sessionEmail);
    throw createFlashMentoringServiceError_('ACCESS_IDENTITY_UNVERIFIED');
  }

  var person = personMatches[0];
  var personId = String(person.personId).trim();
  if (person.active !== true) {
    recordFlashMentoringAccessConfigurationReview_('PERSON_ACTIVE_STATUS_UNVERIFIED', sessionEmail);
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }
  var configuredRoles = FLASH_MENTORING_CONFIG && FLASH_MENTORING_CONFIG.roles
    ? FLASH_MENTORING_CONFIG.roles
    : [];
  var resolvedRoles = [];
  var invalidRoleAssignment = false;
  activeRoles.forEach(function(assignment) {
    var roleCode = String(assignment.roleCode || '').trim();
    if (configuredRoles.indexOf(roleCode) < 0) {
      invalidRoleAssignment = true;
      return;
    }
    if (resolvedRoles.indexOf(roleCode) < 0) resolvedRoles.push(roleCode);
  });
  if (invalidRoleAssignment) {
    recordFlashMentoringAccessConfigurationReview_('ACCESS_ROLE_CONFIGURATION_INVALID', sessionEmail);
    throw createFlashMentoringServiceError_('ACCESS_CONFIGURATION_REVIEW_REQUIRED');
  }

  if (rolesToRequire.length && !rolesToRequire.some(function(roleCode) {
    return resolvedRoles.indexOf(roleCode) >= 0;
  })) {
    recordFlashMentoringAccessConfigurationReview_('ACCESS_ROLE_ASSIGNMENT_REQUIRED', sessionEmail);
    throw createFlashMentoringServiceError_('ACCESS_DENIED');
  }

  return {
    serverVerified: true,
    personId: personId,
    displayName: String(person.displayName || ''),
    corporateEmail: sessionEmail,
    roles: resolvedRoles,
    person: person
  };
}

var AccessService = Object.freeze({
  requireFlashMentoringAccess_: requireFlashMentoringAccess_
});

function getFlashMentoringPortalService_() {
  return {
    resolveSessionActor: resolveFlashMentoringSessionActor_,
    routeTalentException: routeFlashMentoringPortalException_,
    getBootstrap: getFlashMentoringPortalBootstrap_,
    submitMentorProfile: submitFlashMentoringMentorProfile_,
    updateMentorProfile: updateFlashMentoringMentorProfile_,
    submitRequest: submitFlashMentoringRequest_,
    getMyRequests: getFlashMentoringMyRequests_,
    respondToInvite: respondToFlashMentoringInvitation_,
    recordNextMonthAvailability: recordFlashMentoringNextMonthAvailability_,
    updateMatchProgress: updateFlashMentoringMatchProgress_,
    submitPulse: submitFlashMentoringPulse_
  };
}

function resolveFlashMentoringSessionActor_(sessionEmail) {
  var suppliedEmail = normalizeFlashMentoringEmail_(sessionEmail);
  var actualEmail = '';
  try {
    actualEmail = normalizeFlashMentoringEmail_(Session.getActiveUser().getEmail());
  } catch (error) {
    actualEmail = '';
  }
  if (!actualEmail) {
    recordFlashMentoringAccessConfigurationReview_('SESSION_EMAIL_UNAVAILABLE', '');
    return { status: 'NOT_FOUND', actor: null };
  }
  if (!suppliedEmail || suppliedEmail !== actualEmail) {
    recordFlashMentoringAccessConfigurationReview_('SESSION_IDENTITY_CONFLICT', actualEmail);
    return { status: 'CONFLICT', actor: null };
  }
  try {
    var actor = requireFlashMentoringAccess_([]);
    return { status: 'OK', actor: actor };
  } catch (error) {
    return {
      status: error && error.code === 'ACCESS_DENIED' ? 'CONFLICT' : 'NOT_FOUND',
      actor: null
    };
  }
}

function routeFlashMentoringPortalException_(context) {
  context = context || {};
  var reasonCode = String(context.reasonCode || 'PORTAL_EXCEPTION');
  var actualEmail = '';
  try {
    actualEmail = normalizeFlashMentoringEmail_(Session.getActiveUser().getEmail());
  } catch (error) {
    actualEmail = '';
  }
  var suppliedEmail = normalizeFlashMentoringEmail_(context.sessionEmail);
  if (actualEmail && suppliedEmail && actualEmail !== suppliedEmail) {
    reasonCode = 'SESSION_IDENTITY_CONFLICT';
  }
  recordFlashMentoringAccessConfigurationReview_(reasonCode, actualEmail);
  try {
    var id = flashMentoringStableId_('access_review', [reasonCode,
      actualEmail ? flashMentoringStableId_('identity', [actualEmail]) : 'SESSION_IDENTITY_UNAVAILABLE']);
    var queued = queueFlashMentoringTalentReview_('ACCESS_CONFIG', id, reasonCode,
      'ACCESS_CONFIG_REVIEW:' + id);
    return { routed: !!queued };
  } catch (error) {
    return { routed: false };
  }
}

function hasFlashMentoringRole_(actor, roleCode) {
  return !!(actor && actor.serverVerified === true && Array.isArray(actor.roles)
    && actor.roles.indexOf(String(roleCode)) >= 0);
}

function requireVerifiedFlashMentoringActor_(actor) {
  if (!actor || actor.serverVerified !== true || !actor.personId || !actor.person) {
    throw createFlashMentoringServiceError_('ACCESS_IDENTITY_UNVERIFIED');
  }
  return actor;
}

function normalizeFlashMentoringRequiredRoles_(requiredRoles) {
  if (requiredRoles == null || requiredRoles === '') return [];
  var roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
  return roles.map(function(role) { return String(role || '').trim(); })
    .filter(function(role, index, values) {
      return role && values.indexOf(role) === index;
    });
}

function normalizeFlashMentoringEmail_(value) {
  return value == null ? '' : String(value).trim().toLowerCase();
}

function recordFlashMentoringAccessConfigurationReview_(reasonCode, sessionEmail) {
  var identityKey = sessionEmail
    ? flashMentoringStableId_('identity', [normalizeFlashMentoringEmail_(sessionEmail)])
    : 'SESSION_IDENTITY_UNAVAILABLE';
  var reviewId = flashMentoringStableId_('access_review', [reasonCode, identityKey]);
  recordFlashMentoringAudit_('', 'ACCESS_CONFIGURATION_REVIEW_REQUIRED', 'ACCESS_CONFIG', reviewId, {
    reasonCode: reasonCode
  }, 'ACCESS_CONFIG_REVIEW:' + reviewId);
  try {
    queueFlashMentoringTalentReview_('ACCESS_CONFIG', reviewId, reasonCode, 'ACCESS_CONFIG_REVIEW:' + reviewId);
  } catch (error) {
    Logger.log('FLASH_MENTORING_ACCESS_REVIEW_QUEUE_FAILED');
  }
}
