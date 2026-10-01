var FLASH_MENTORING_FOLLOW_UP_SETTINGS = Object.freeze({
  reminderDays: 'FOLLOW_UP_REMINDER_DAYS',
  talentEscalationDays: 'FOLLOW_UP_TALENT_ESCALATION_DAYS'
});

function getFlashMentoringFollowUpPolicy_(repositories) {
  repositories = repositories || getFlashMentoringRepositories_();
  var settings = repositories.SETTINGS.listAll();
  var reminderDays = readFlashMentoringDaySetting_(settings, FLASH_MENTORING_FOLLOW_UP_SETTINGS.reminderDays, 14);
  var escalationDays = readFlashMentoringDaySetting_(settings, FLASH_MENTORING_FOLLOW_UP_SETTINGS.talentEscalationDays, 21);
  var pendingConfiguration = reminderDays == null || escalationDays == null;
  if (pendingConfiguration) {
    queueFlashMentoringTalentReview_('SETTINGS', 'FOLLOW_UP_POLICY', 'FOLLOW_UP_CADENCE_CONFIGURATION_REQUIRED');
  }
  return {
    reminderDays: reminderDays,
    talentEscalationDays: escalationDays,
    pendingConfiguration: pendingConfiguration
  };
}

function scheduleFlashMentoringFollowUpAfterProgress_(repositories, match, progressAction) {
  var action = String(progressAction || '');
  var scheduledAt = parseFlashMentoringFollowUpDate_(match && match.acceptedAt);
  if (!scheduledAt) {
    queueFlashMentoringTalentReview_('MATCHES', match && match.matchId, 'MATCH_ACCEPTED_AT_MISSING');
    return;
  }
  var policy = getFlashMentoringFollowUpPolicy_(repositories);
  if (action === 'STILL_ALIGNING' || action === 'NO_CONTACT') {
    if (policy.reminderDays == null || policy.talentEscalationDays == null) {
      queueFlashMentoringTalentReview_('SETTINGS', 'FOLLOW_UP_POLICY', 'FOLLOW_UP_CADENCE_CONFIGURATION_REQUIRED');
      return;
    }
    queueFlashMentoringNotification_({
      recipientPersonId: match.menteePersonId,
      templateKey: 'MENTEE_CONTACT_REMINDER_D' + policy.reminderDays,
      relatedEntity: 'MATCHES',
      relatedEntityId: match.matchId,
      scheduledAt: addFlashMentoringDays_(scheduledAt, policy.reminderDays),
      dedupeKey: 'CONTACT_REMINDER:' + match.matchId + ':' + policy.reminderDays
    });
  }
  if (action === 'SCHEDULED' || action === 'RESCHEDULED') {
    var meetingDate = parseFlashMentoringFollowUpDate_(match.scheduledAt);
    if (!meetingDate) {
      queueFlashMentoringTalentReview_('MATCHES', match.matchId, 'MATCH_SCHEDULED_DATE_MISSING');
      return;
    }
    queueFlashMentoringNotification_({
      recipientPersonId: match.menteePersonId,
      templateKey: 'MATCH_OUTCOME_CHECKIN',
      relatedEntity: 'MATCHES',
      relatedEntityId: match.matchId,
      scheduledAt: addFlashMentoringDays_(meetingDate, 1),
      dedupeKey: 'MATCH_OUTCOME_CHECKIN:' + match.matchId + ':' + meetingDate.toISOString()
    });
  }
}

function processFlashMentoringFollowUps_(nowValue) {
  var now = parseFlashMentoringFollowUpDate_(nowValue) || new Date();
  var repositories = getFlashMentoringRepositories_();
  var matches = repositories.MATCHES.listAll();
  var auditEvents = repositories.AUDIT_LOG.listAll();
  var policy = getFlashMentoringFollowUpPolicy_(repositories);
  var queued = 0;
  var activeMatches = matches.filter(function(match) {
    return isFlashMentoringMatchActive_(String(match.status || ''));
  });

  if (policy.pendingConfiguration && activeMatches.length) {
    queueFlashMentoringTalentReview_('SETTINGS', 'FOLLOW_UP_POLICY', 'FOLLOW_UP_CADENCE_CONFIGURATION_REQUIRED');
  }

  activeMatches.forEach(function(match) {
    var acceptedAt = parseFlashMentoringFollowUpDate_(match.acceptedAt);
    if (!acceptedAt) {
      routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_ACCEPTED_AT_MISSING');
      return;
    }
    var progressEvents = auditEvents.filter(function(event) {
      return String(event.entityName) === 'MATCHES'
        && String(event.entityId) === String(match.matchId)
        && String(event.action) === 'MATCH_PROGRESS_UPDATED';
    }).map(readFlashMentoringAuditMetadata_);
    var hasContactResponse = progressEvents.some(function(metadata) {
      return ['SCHEDULED', 'STILL_ALIGNING', 'NO_CONTACT'].indexOf(metadata.followUpAction) >= 0;
    });

    if (!hasContactResponse && now.getTime() >= addFlashMentoringDays_(acceptedAt, 7).getTime()) {
      var firstContactQueued = queueFlashMentoringNotification_({
        recipientPersonId: match.menteePersonId,
        templateKey: 'MENTEE_CONTACT_CHECKIN_D7',
        relatedEntity: 'MATCHES',
        relatedEntityId: match.matchId,
        scheduledAt: addFlashMentoringDays_(acceptedAt, 7),
        dedupeKey: 'CONTACT_CHECKIN_D7:' + match.matchId
      });
      if (firstContactQueued) queued += 1;
    }

    var hasScheduledDate = !!parseFlashMentoringFollowUpDate_(match.scheduledAt);
    var hasOutcome = progressEvents.some(function(metadata) {
      return ['REALIZED', 'CANCELLED', 'NOT_REALIZED'].indexOf(metadata.followUpAction) >= 0;
    });
    if (hasScheduledDate && !hasOutcome) {
      var meetingDate = parseFlashMentoringFollowUpDate_(match.scheduledAt);
      var outcomeDueAt = addFlashMentoringDays_(meetingDate, 1);
      if (now.getTime() >= outcomeDueAt.getTime()) {
        var outcomeQueued = queueFlashMentoringNotification_({
          recipientPersonId: match.menteePersonId,
          templateKey: 'MATCH_OUTCOME_CHECKIN',
          relatedEntity: 'MATCHES',
          relatedEntityId: match.matchId,
          scheduledAt: outcomeDueAt,
          dedupeKey: 'MATCH_OUTCOME_CHECKIN:' + match.matchId + ':' + meetingDate.toISOString()
        });
        if (outcomeQueued) queued += 1;
      }
    }

    if (!hasScheduledDate && policy.reminderDays != null
        && now.getTime() >= addFlashMentoringDays_(acceptedAt, policy.reminderDays).getTime()) {
      var reminderQueued = queueFlashMentoringNotification_({
        recipientPersonId: match.menteePersonId,
        templateKey: 'MENTEE_CONTACT_REMINDER_D' + policy.reminderDays,
        relatedEntity: 'MATCHES',
        relatedEntityId: match.matchId,
        scheduledAt: addFlashMentoringDays_(acceptedAt, policy.reminderDays),
        dedupeKey: 'CONTACT_REMINDER:' + match.matchId + ':' + policy.reminderDays
      });
      if (reminderQueued) queued += 1;
    }

    if (!hasScheduledDate && policy.talentEscalationDays != null
        && now.getTime() >= addFlashMentoringDays_(acceptedAt, policy.talentEscalationDays).getTime()) {
      routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_NO_CONTACT_ESCALATION');
    }

    var conversationDeadline = parseFlashMentoringFollowUpDate_(match.conversationDeadlineAt);
    if (!hasScheduledDate && conversationDeadline && now.getTime() >= conversationDeadline.getTime()) {
      routeFlashMentoringMatchToTalent_(repositories, match, 'MATCH_CONVERSATION_DEADLINE_REVIEW');
    }
  });

  return { activeMatches: activeMatches.length, notificationsQueued: queued };
}

function getFlashMentoringBusinessDeadlines_(acceptedAt) {
  var accepted = parseFlashMentoringFollowUpDate_(acceptedAt);
  if (!accepted) return null;
  return {
    firstContactDeadlineAt: addFlashMentoringBusinessDays_(accepted, 5),
    conversationDeadlineAt: addFlashMentoringDays_(accepted, 30)
  };
}

function readFlashMentoringDaySetting_(settings, settingKey, expectedDays) {
  var setting = (settings || []).filter(function(record) {
    return String(record.settingKey) === settingKey;
  })[0];
  if (!setting || setting.settingValue == null || String(setting.settingValue).trim() === '') return null;
  var value = Number(setting.settingValue);
  if (!isFinite(value) || Math.floor(value) !== value || value !== expectedDays) return null;
  return value;
}

function readFlashMentoringAuditMetadata_(event) {
  try {
    var value = JSON.parse(String(event.metadataJson || '{}'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch (error) {
    return {};
  }
}

function parseFlashMentoringFollowUpDate_(value) {
  if (value instanceof Date && isFinite(value.getTime())) return new Date(value.getTime());
  if (value == null || value === '') return null;
  var date = new Date(value);
  return isFinite(date.getTime()) ? date : null;
}

function addFlashMentoringDays_(date, days) {
  return new Date(date.getTime() + Number(days) * 24 * 60 * 60 * 1000);
}

function addFlashMentoringBusinessDays_(date, days) {
  var result = new Date(date.getTime());
  var remaining = Number(days);
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    var day = result.getUTCDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return result;
}
