var FLASH_MENTORING_SCHEMAS = Object.freeze({
  PEOPLE_MASTER: Object.freeze({
    // personId is the stable employee ID (matricula); corporateEmail is an attribute, not a key.
    keyField: 'personId',
    columns: Object.freeze([
      'personId', 'corporateEmail', 'displayName', 'active', 'jobTitle', 'area', 'unit',
      'wcBc', 'descricaoNivel1', 'cluster', 'careerLevel', 'immediateManagerPersonId',
      'hrRepresentativePersonId', 'companyTenureMonths', 'sourceUpdatedAt'
    ])
  }),
  MENTORS: Object.freeze({
    keyField: 'personId',
    columns: Object.freeze([
      'personId', 'status', 'capacityLimit', 'experienceSummary',
      'curatedByPersonId', 'curatedAt', 'createdAt', 'updatedAt'
    ])
  }),
  MENTOR_TOPICS: Object.freeze({
    keyField: 'mentorTopicId',
    columns: Object.freeze([
      'mentorTopicId', 'mentorPersonId', 'category', 'topicName',
      'experienceTag', 'createdAt'
    ])
  }),
  REQUESTS: Object.freeze({
    keyField: 'requestId',
    columns: Object.freeze([
      'requestId', 'menteePersonId', 'topicCategory', 'topicName',
      'challengeSummary', 'desiredOutcome', 'consentAcknowledged', 'status',
      'currentShortlistVersion', 'reviewedByPersonId', 'reviewDecision',
      'reviewedAt', 'submittedAt', 'createdAt', 'updatedAt'
    ])
  }),
  REQUEST_CANDIDATES: Object.freeze({
    keyField: 'candidateId',
    columns: Object.freeze([
      'candidateId', 'requestId', 'shortlistVersion', 'candidateOrder',
      'mentorPersonId', 'rationale', 'status', 'createdAt', 'updatedAt'
    ])
  }),
  MATCHES: Object.freeze({
    keyField: 'matchId',
    columns: Object.freeze([
      'matchId', 'requestId', 'menteePersonId', 'mentorPersonId', 'status',
      'acceptedAt', 'firstContactDeadlineAt', 'conversationDeadlineAt',
      'scheduledAt', 'closedAt', 'createdAt', 'updatedAt'
    ])
  }),
  PULSE: Object.freeze({
    keyField: 'pulseId',
    columns: Object.freeze([
      'pulseId', 'matchId', 'menteePersonId', 'reflectionRating',
      'matchFitRating', 'recommendationAnswer', 'comment', 'submittedAt'
    ])
  }),
  ACCESS_ROLES: Object.freeze({
    keyField: 'roleAssignmentId',
    columns: Object.freeze([
      'roleAssignmentId', 'personId', 'roleCode', 'grantedByPersonId',
      'grantedAt', 'revokedAt'
    ])
  }),
  AUDIT_LOG: Object.freeze({
    keyField: 'eventId',
    columns: Object.freeze([
      'eventId', 'actorPersonId', 'action', 'entityName', 'entityId',
      'metadataJson', 'createdAt'
    ])
  }),
  NOTIFICATION_OUTBOX: Object.freeze({
    keyField: 'notificationId',
    columns: Object.freeze([
      'notificationId', 'recipientPersonId', 'templateKey', 'relatedEntity',
      'relatedEntityId', 'status', 'scheduledAt', 'sentAt', 'attemptCount',
      'lastError', 'createdAt', 'updatedAt'
    ])
  }),
  SETTINGS: Object.freeze({
    keyField: 'settingKey',
    columns: Object.freeze([
      'settingKey', 'settingValue', 'description', 'updatedAt',
      'updatedByPersonId'
    ])
  })
});
