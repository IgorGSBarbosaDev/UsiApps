/**
 * Notifications are persisted to NOTIFICATION_OUTBOX only. This service does
 * not send email or call an external messaging provider.
 */
function queueFlashMentoringNotification_(input) {
  input = input || {};
  var recipientPersonId = input.recipientPersonId == null ? '' : String(input.recipientPersonId).trim();
  var templateKey = String(input.templateKey || '').trim();
  var relatedEntity = String(input.relatedEntity || 'SYSTEM').trim();
  var relatedEntityId = input.relatedEntityId == null ? '' : String(input.relatedEntityId);
  var scheduledAt = normalizeFlashMentoringNotificationDate_(input.scheduledAt);
  if (!templateKey || !scheduledAt) {
    recordFlashMentoringAudit_('', 'NOTIFICATION_QUEUE_REJECTED', relatedEntity, relatedEntityId, {
      reasonCode: 'NOTIFICATION_INPUT_INVALID',
      templateKey: templateKey || 'MISSING_TEMPLATE'
    });
    return null;
  }

  var dedupeKey = input.dedupeKey || [
    recipientPersonId,
    templateKey,
    relatedEntity,
    relatedEntityId,
    scheduledAt.toISOString()
  ].join('|');
  var notificationId = flashMentoringStableId_('notification', [dedupeKey]);
  var repositories = getFlashMentoringRepositories_();
  var existing = repositories.NOTIFICATION_OUTBOX.listAll().filter(function(item) {
    return String(item.notificationId) === notificationId;
  })[0];
  if (existing) return existing;

  var notification = {
    notificationId: notificationId,
    recipientPersonId: recipientPersonId,
    templateKey: templateKey,
    relatedEntity: relatedEntity,
    relatedEntityId: relatedEntityId,
    status: recipientPersonId ? 'QUEUED' : 'PENDING_CONFIGURATION',
    scheduledAt: scheduledAt,
    sentAt: '',
    attemptCount: 0,
    lastError: recipientPersonId ? '' : 'NO_TALENT_RECIPIENT_CONFIGURED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    repositories.NOTIFICATION_OUTBOX.appendMany([notification]);
  } catch (error) {
    var afterRace = repositories.NOTIFICATION_OUTBOX.listAll().filter(function(item) {
      return String(item.notificationId) === notificationId;
    })[0];
    if (afterRace) return afterRace;
    Logger.log('FLASH_MENTORING_NOTIFICATION_QUEUE_WRITE_FAILED');
    recordFlashMentoringAudit_('', 'NOTIFICATION_QUEUE_FAILED', relatedEntity, relatedEntityId, {
      reasonCode: 'NOTIFICATION_QUEUE_WRITE_FAILED',
      templateKey: templateKey
    });
    return null;
  }

  recordFlashMentoringAudit_('', 'NOTIFICATION_QUEUED', relatedEntity, relatedEntityId, {
    notificationId: notificationId,
    templateKey: templateKey
  }, 'NOTIFICATION_QUEUED:' + notificationId);
  return notification;
}

function queueFlashMentoringTalentReview_(entityName, entityId, reasonCode, dedupeKey) {
  var repositories = getFlashMentoringRepositories_();
  var talentPersonIds = repositories.ACCESS_ROLES.listAll()
    .filter(function(role) {
      return String(role.roleCode) === 'TALENT' && !hasFlashMentoringValue_(role.revokedAt);
    })
    .map(function(role) { return String(role.personId || '').trim(); })
    .filter(function(personId, index, values) {
      return personId && values.indexOf(personId) === index;
    });
  var relatedEntity = String(entityName || 'SYSTEM');
  var relatedEntityId = entityId == null ? '' : String(entityId);
  var safeReason = String(reasonCode || 'TALENT_REVIEW_REQUIRED');
  var stableKey = dedupeKey || ['TALENT_REVIEW', relatedEntity, relatedEntityId, safeReason].join('|');

  if (!talentPersonIds.length) {
    return queueFlashMentoringNotification_({
      recipientPersonId: '',
      templateKey: 'TALENT_REVIEW_RECIPIENT_CONFIGURATION_REQUIRED',
      relatedEntity: relatedEntity,
      relatedEntityId: relatedEntityId,
      scheduledAt: new Date(),
      dedupeKey: stableKey + '|UNASSIGNED'
    });
  }

  return talentPersonIds.map(function(personId) {
    return queueFlashMentoringNotification_({
      recipientPersonId: personId,
      templateKey: 'TALENT_REVIEW_REQUIRED',
      relatedEntity: relatedEntity,
      relatedEntityId: relatedEntityId,
      scheduledAt: new Date(),
      dedupeKey: stableKey + '|' + personId
    });
  });
}

function processFlashMentoringNotificationQueue_(nowValue) {
  var now = normalizeFlashMentoringNotificationDate_(nowValue) || new Date();
  var repositories = getFlashMentoringRepositories_();
  var queued = repositories.NOTIFICATION_OUTBOX.listAll().filter(function(notification) {
    return String(notification.status) === 'QUEUED';
  });
  if (!queued.length) return { processed: 0, blocked: 0 };

  var invalid = queued.filter(function(notification) {
    return !normalizeFlashMentoringNotificationDate_(notification.scheduledAt)
      || !String(notification.templateKey || '').trim()
      || !String(notification.recipientPersonId || '').trim();
  });
  var due = queued.filter(function(notification) {
    var scheduledAt = normalizeFlashMentoringNotificationDate_(notification.scheduledAt);
    return scheduledAt && scheduledAt.getTime() <= now.getTime()
      && invalid.indexOf(notification) < 0;
  });
  var records = invalid.map(function(notification) {
    var nextAttemptCount = Number(notification.attemptCount || 0) + 1;
    queueFlashMentoringTalentReview_(notification.relatedEntity, notification.relatedEntityId,
      'NOTIFICATION_DATA_INVALID');
    recordFlashMentoringAudit_('', 'NOTIFICATION_ATTEMPT_FAILED', notification.relatedEntity,
      notification.relatedEntityId, {
        notificationId: notification.notificationId,
        templateKey: notification.templateKey || 'MISSING_TEMPLATE',
        attemptCount: nextAttemptCount,
        reasonCode: 'NOTIFICATION_DATA_INVALID'
      }, 'NOTIFICATION_ATTEMPT_FAILED:' + notification.notificationId + ':' + nextAttemptCount);
    return {
      notificationId: notification.notificationId,
      status: 'BLOCKED_INVALID_DATA',
      attemptCount: nextAttemptCount,
      lastError: 'NOTIFICATION_DATA_INVALID',
      updatedAt: now.toISOString()
    };
  });
  records = records.concat(due.map(function(notification) {
    var nextAttemptCount = Number(notification.attemptCount || 0) + 1;
    recordFlashMentoringAudit_('', 'NOTIFICATION_DELIVERY_BLOCKED', notification.relatedEntity,
      notification.relatedEntityId, {
        notificationId: notification.notificationId,
        templateKey: notification.templateKey,
        attemptCount: nextAttemptCount,
        reasonCode: 'EMAIL_DELIVERY_DISABLED'
      }, 'NOTIFICATION_DELIVERY_BLOCKED:' + notification.notificationId + ':' + nextAttemptCount);
    return {
      notificationId: notification.notificationId,
      status: 'BLOCKED_DELIVERY_DISABLED',
      attemptCount: nextAttemptCount,
      lastError: 'EMAIL_DELIVERY_DISABLED',
      updatedAt: now.toISOString()
    };
  }));
  if (!records.length) return { processed: 0, blocked: 0 };
  repositories.NOTIFICATION_OUTBOX.upsertMany(records);
  return { processed: records.length, blocked: records.length };
}

function cancelFlashMentoringNotification_(relatedEntity, relatedEntityId, templatePrefix, reasonCode) {
  var entity = String(relatedEntity || 'SYSTEM');
  var entityId = String(relatedEntityId == null ? '' : relatedEntityId);
  var prefix = String(templatePrefix || '');
  if (!entityId || !prefix) return 0;
  try {
    var repositories = getFlashMentoringRepositories_();
    var now = new Date().toISOString();
    var pending = repositories.NOTIFICATION_OUTBOX.listAll().filter(function(notification) {
      return String(notification.relatedEntity) === entity
        && String(notification.relatedEntityId) === entityId
        && String(notification.templateKey || '').indexOf(prefix) === 0
        && ['QUEUED', 'PENDING_CONFIGURATION'].indexOf(String(notification.status)) >= 0;
    });
    if (!pending.length) return 0;
    repositories.NOTIFICATION_OUTBOX.upsertMany(pending.map(function(notification) {
      return {
        notificationId: String(notification.notificationId),
        status: 'CANCELLED',
        lastError: String(reasonCode || 'NOTIFICATION_NO_LONGER_APPLICABLE'),
        updatedAt: now
      };
    }));
    recordFlashMentoringAudit_('', 'NOTIFICATIONS_CANCELLED', entity, entityId, {
      reasonCode: String(reasonCode || 'NOTIFICATION_NO_LONGER_APPLICABLE'),
      candidateCount: pending.length
    }, 'NOTIFICATIONS_CANCELLED:' + entity + ':' + entityId + ':' + prefix + ':' + String(reasonCode || ''));
    return pending.length;
  } catch (error) {
    Logger.log('FLASH_MENTORING_NOTIFICATION_CANCEL_FAILED');
    try {
      queueFlashMentoringTalentReview_(entity, entityId, 'NOTIFICATION_CANCEL_REVIEW_REQUIRED');
    } catch (queueError) {
      Logger.log('FLASH_MENTORING_NOTIFICATION_CANCEL_REVIEW_QUEUE_FAILED');
    }
    return 0;
  }
}

function normalizeFlashMentoringNotificationDate_(value) {
  if (value instanceof Date && isFinite(value.getTime())) return new Date(value.getTime());
  if (value == null || value === '') return null;
  var date = new Date(value);
  return isFinite(date.getTime()) ? date : null;
}

function hasFlashMentoringValue_(value) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}
