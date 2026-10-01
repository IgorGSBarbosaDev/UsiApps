var FLASH_MENTORING_MATCH_STATUSES = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  SCHEDULED: 'SCHEDULED',
  REALIZED: 'REALIZED',
  CANCELLED: 'CANCELLED',
  NOT_REALIZED: 'NOT_REALIZED'
});

var FLASH_MENTORING_CAPACITY_RESERVATION_PREFIX = 'FLASH_MENTORING_CAPACITY_RESERVATION_';
var FLASH_MENTORING_MATCH_FINALIZATION_PREFIX = 'FLASH_MENTORING_MATCH_FINALIZATION_';
var FLASH_MENTORING_CAPACITY_OPERATION_TTL_MS = 10 * 60 * 1000;

function withFlashMentoringCapacityLock_(callback) {
  var timeoutMs = FLASH_MENTORING_CONFIG && FLASH_MENTORING_CONFIG.writeLockTimeoutMs
    ? FLASH_MENTORING_CONFIG.writeLockTimeoutMs
    : 30000;
  var lock = LockService.getScriptLock();
  lock.waitLock(timeoutMs);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function isFlashMentoringMatchActive_(status) {
  return status === FLASH_MENTORING_MATCH_STATUSES.ACCEPTED
    || status === FLASH_MENTORING_MATCH_STATUSES.SCHEDULED;
}

function isFlashMentoringMatchFinal_(status) {
  return status === FLASH_MENTORING_MATCH_STATUSES.REALIZED
    || status === FLASH_MENTORING_MATCH_STATUSES.CANCELLED
    || status === FLASH_MENTORING_MATCH_STATUSES.NOT_REALIZED;
}

function getFlashMentoringCapacitySnapshot_(repositories, mentorPersonId) {
  repositories = repositories || getFlashMentoringRepositories_();
  return withFlashMentoringCapacityLock_(function() {
    return getFlashMentoringCapacitySnapshotLocked_(repositories, mentorPersonId);
  });
}

function getFlashMentoringCapacitySnapshotLocked_(repositories, mentorPersonId) {
  var mentorId = normalizeFlashMentoringCapacityId_(mentorPersonId);
  if (!mentorId) throw createFlashMentoringServiceError_('MENTOR_ID_MISSING');

  var mentor = repositories.MENTORS.listAll().filter(function(record) {
    return String(record.personId) === mentorId;
  })[0];
  if (!mentor) throw createFlashMentoringServiceError_('MENTOR_DATA_MISSING');
  var isActive = String(mentor.status) === 'ACTIVE';
  var limit = normalizeFlashMentoringCapacityLimit_(mentor.capacityLimit);
  if (limit == null) throw createFlashMentoringServiceError_('MENTOR_CAPACITY_INVALID');
  var matches = repositories.MATCHES.listAll().filter(function(match) {
    return String(match.mentorPersonId) === mentorId;
  });
  var persistedMatchIds = Object.create(null);
  var occupiedCount = 0;
  matches.forEach(function(match) {
    var status = String(match.status || '');
    persistedMatchIds[String(match.matchId)] = true;
    if (isFlashMentoringMatchActive_(status)) {
      occupiedCount += 1;
      return;
    }
    if (!isFlashMentoringMatchFinal_(status)) {
      throw createFlashMentoringServiceError_('MATCH_STATUS_INVALID');
    }
  });
  listFlashMentoringCapacityReservationsLocked_().forEach(function(reservation) {
    if (String(reservation.mentorPersonId) !== mentorId
        || persistedMatchIds[String(reservation.matchId)]) return;
    occupiedCount += 1;
  });
  if (occupiedCount > limit) throw createFlashMentoringServiceError_('MENTOR_CAPACITY_OVERCOMMITTED');
  return {
    mentorPersonId: mentorId,
    capacityLimit: limit,
    occupiedCount: occupiedCount,
    availableCount: isActive ? limit - occupiedCount : 0,
    active: isActive
  };
}

function getFlashMentoringCapacityMap_(repositories, mentorRecords) {
  repositories = repositories || getFlashMentoringRepositories_();
  if (!Array.isArray(mentorRecords)) throw createFlashMentoringServiceError_('MENTOR_POOL_MISSING');
  return withFlashMentoringCapacityLock_(function() {
    var availableByMentorId = {};
    mentorRecords.forEach(function(mentor) {
      if (!mentor || String(mentor.status) !== 'ACTIVE') return;
      var snapshot = getFlashMentoringCapacitySnapshotLocked_(repositories, mentor.personId);
      availableByMentorId[String(snapshot.mentorPersonId)] = snapshot.availableCount;
    });
    return availableByMentorId;
  });
}

function releaseFlashMentoringSlot_(repositories, matchId, terminalStatus, actorPersonId) {
  repositories = repositories || getFlashMentoringRepositories_();
  var finalStatus = String(terminalStatus || '');
  if (!isFlashMentoringMatchFinal_(finalStatus)) {
    throw createFlashMentoringServiceError_('MATCH_FINAL_STATUS_INVALID');
  }

  var result = withFlashMentoringCapacityLock_(function() {
    var match = repositories.MATCHES.listAll().filter(function(record) {
      return String(record.matchId) === String(matchId);
    })[0];
    if (!match) throw createFlashMentoringServiceError_('MATCH_NOT_FOUND');
    if (isFlashMentoringMatchFinal_(String(match.status))) {
      return { changed: false, alreadyFinal: String(match.status) === finalStatus, match: match };
    }
    if (!isFlashMentoringMatchActive_(String(match.status))) {
      throw createFlashMentoringServiceError_('MATCH_STATUS_INVALID');
    }

    var now = new Date().toISOString();
    var finalizationKey = getFlashMentoringMatchFinalizationKey_(matchId);
    var existingFinalization = readFlashMentoringCapacityProperty_(finalizationKey);
    if (existingFinalization) {
      if (String(existingFinalization.status) !== finalStatus) {
        throw createFlashMentoringServiceError_('CONFLICT');
      }
      return { changed: false, inProgress: true, match: match };
    }
    writeFlashMentoringCapacityProperty_(finalizationKey, {
      status: finalStatus,
      createdAt: now,
      expiresAt: new Date(Date.now() + FLASH_MENTORING_CAPACITY_OPERATION_TTL_MS).toISOString()
    });
    return { changed: true, match: match, finalizationKey: finalizationKey };
  });

  if (!result.changed) {
    if (result.alreadyFinal) {
      recordFlashMentoringAudit_(actorPersonId, 'CAPACITY_SLOT_RELEASED', 'MATCHES', matchId, {
        previousStatus: 'ACTIVE',
        nextStatus: finalStatus
      }, 'CAPACITY_SLOT_RELEASED:' + String(matchId));
    }
    return result;
  }

  var previousStatus = String(result.match.status);
  var nowText = new Date().toISOString();
  try {
    repositories.MATCHES.upsertMany([{
      matchId: String(result.match.matchId),
      status: finalStatus,
      closedAt: nowText,
      updatedAt: nowText
    }]);
  } catch (error) {
    clearFlashMentoringCapacityProperty_(result.finalizationKey);
    throw error;
  }

  result.match.status = finalStatus;
  result.match.closedAt = nowText;
  result.match.updatedAt = nowText;
  clearFlashMentoringCapacityProperty_(result.finalizationKey);
  clearFlashMentoringCapacityReservation_(result.match.matchId);
  recordFlashMentoringAudit_(actorPersonId, 'CAPACITY_SLOT_RELEASED', 'MATCHES', matchId, {
    previousStatus: previousStatus,
    nextStatus: finalStatus
  }, 'CAPACITY_SLOT_RELEASED:' + String(matchId));
  return result;
}

function reserveFlashMentoringCapacitySlotLocked_(repositories, mentorPersonId, matchId) {
  var mentorId = normalizeFlashMentoringCapacityId_(mentorPersonId);
  var stableMatchId = normalizeFlashMentoringCapacityId_(matchId);
  if (!mentorId || !stableMatchId) throw createFlashMentoringServiceError_('CAPACITY_RESERVATION_INPUT_INVALID');
  var key = getFlashMentoringCapacityReservationKey_(stableMatchId);
  var existing = readFlashMentoringCapacityProperty_(key);
  if (existing && isFlashMentoringCapacityPropertyCurrent_(existing)) {
    if (String(existing.mentorPersonId) !== mentorId) throw createFlashMentoringServiceError_('CONFLICT');
    return { reserved: true, alreadyReserved: true };
  }
  if (existing) PropertiesService.getScriptProperties().deleteProperty(key);

  var snapshot = getFlashMentoringCapacitySnapshotLocked_(repositories, mentorId);
  if (snapshot.availableCount < 1) return { reserved: false, capacityUnavailable: true };
  var now = new Date();
  writeFlashMentoringCapacityProperty_(key, {
    matchId: stableMatchId,
    mentorPersonId: mentorId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + FLASH_MENTORING_CAPACITY_OPERATION_TTL_MS).toISOString()
  });
  return { reserved: true, alreadyReserved: false };
}

function clearFlashMentoringCapacityReservation_(matchId) {
  clearFlashMentoringCapacityProperty_(getFlashMentoringCapacityReservationKey_(matchId));
}

function listFlashMentoringCapacityReservationsLocked_() {
  var properties = PropertiesService.getScriptProperties().getProperties();
  var now = Date.now();
  return Object.keys(properties).filter(function(key) {
    return key.indexOf(FLASH_MENTORING_CAPACITY_RESERVATION_PREFIX) === 0;
  }).map(function(key) {
    var reservation;
    try {
      reservation = JSON.parse(properties[key]);
    } catch (error) {
      throw createFlashMentoringServiceError_('CAPACITY_RESERVATION_STATE_INVALID');
    }
    var expiry = Date.parse(String(reservation && reservation.expiresAt || ''));
    if (!reservation || !reservation.matchId || !reservation.mentorPersonId
        || !isFinite(expiry)) {
      throw createFlashMentoringServiceError_('CAPACITY_RESERVATION_STATE_INVALID');
    }
    if (expiry <= now) {
      PropertiesService.getScriptProperties().deleteProperty(key);
      return null;
    }
    return reservation;
  }).filter(function(value) { return !!value; });
}

function isFlashMentoringCapacityPropertyCurrent_(record) {
  var expiry = Date.parse(String(record && record.expiresAt || ''));
  return isFinite(expiry) && expiry > Date.now();
}

function readFlashMentoringCapacityProperty_(key) {
  var raw = PropertiesService.getScriptProperties().getProperty(key);
  if (!raw) return null;
  try {
    var value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw createFlashMentoringServiceError_('CAPACITY_RESERVATION_STATE_INVALID');
    }
    if (!isFlashMentoringCapacityPropertyCurrent_(value)) {
      PropertiesService.getScriptProperties().deleteProperty(key);
      return null;
    }
    return value;
  } catch (error) {
    if (error && error.code === 'CAPACITY_RESERVATION_STATE_INVALID') throw error;
    throw createFlashMentoringServiceError_('CAPACITY_RESERVATION_STATE_INVALID');
  }
}

function writeFlashMentoringCapacityProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value));
}

function clearFlashMentoringCapacityProperty_(key) {
  withFlashMentoringCapacityLock_(function() {
    PropertiesService.getScriptProperties().deleteProperty(key);
  });
}

function getFlashMentoringCapacityReservationKey_(matchId) {
  return FLASH_MENTORING_CAPACITY_RESERVATION_PREFIX
    + flashMentoringStableId_('capacity', [String(matchId)]);
}

function getFlashMentoringMatchFinalizationKey_(matchId) {
  return FLASH_MENTORING_MATCH_FINALIZATION_PREFIX
    + flashMentoringStableId_('finalization', [String(matchId)]);
}

function normalizeFlashMentoringCapacityId_(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

function normalizeFlashMentoringCapacityLimit_(value) {
  var numeric = typeof value === 'number' ? value : Number(String(value == null ? '' : value).trim());
  if (!isFinite(numeric) || Math.floor(numeric) !== numeric || (numeric !== 1 && numeric !== 2)) return null;
  return numeric;
}

function createFlashMentoringServiceError_(code) {
  var error = new Error(String(code || 'FLASH_MENTORING_SERVICE_ERROR'));
  error.code = String(code || 'FLASH_MENTORING_SERVICE_ERROR');
  return error;
}
