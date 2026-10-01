/**
 * Persistencia de auditoria com metadados estritamente estruturados.
 * Texto de desafio, expectativa, comentario, e-mail e mensagens de erro brutas
 * nunca entram em AUDIT_LOG.
 */
var FLASH_MENTORING_AUDIT_METADATA_FIELDS = Object.freeze({
  reasonCode: true,
  code: true,
  previousStatus: true,
  nextStatus: true,
  decision: true,
  candidateCount: true,
  shortlistVersion: true,
  roleCode: true,
  capacityLimit: true,
  occupiedCount: true,
  availableCount: true,
  notificationId: true,
  templateKey: true,
  attemptCount: true,
  followUpAction: true,
  matchStatus: true,
  reflectionRating: true,
  matchFitRating: true,
  scaleConfigured: true,
  policyKey: true,
  policyConfigured: true,
  scheduledDays: true,
  currentShortlistVersion: true,
  responseCode: true
});

function flashMentoringStableId_(namespace, parts) {
  var prefix = String(namespace || 'id').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  var source = [prefix].concat(parts || []).map(function(part) {
    return part == null ? '' : String(part);
  }).join('|');
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    source,
    Utilities.Charset.UTF_8
  );
  var hex = digest.map(function(byte) {
    var unsignedByte = byte < 0 ? byte + 256 : byte;
    return ('0' + unsignedByte.toString(16)).slice(-2);
  }).join('');
  return prefix + '_' + hex.slice(0, 40);
}

function sanitizeFlashMentoringAuditMetadata_(metadata) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  var safe = {};
  Object.keys(metadata).forEach(function(key) {
    if (!FLASH_MENTORING_AUDIT_METADATA_FIELDS[key]) return;
    var value = metadata[key];
    if (typeof value === 'boolean' || (typeof value === 'number' && isFinite(value))) {
      safe[key] = value;
      return;
    }
    if (typeof value === 'string') {
      var normalized = value.trim();
      if (normalized && normalized.length <= 120 && /^[A-Za-z0-9_.:+-]+$/.test(normalized)) {
        safe[key] = normalized;
      }
    }
  });
  return safe;
}

function recordFlashMentoringAudit_(actorPersonId, action, entityName, entityId, metadata, idempotencyKey) {
  try {
    var repositories = getFlashMentoringRepositories_();
    var eventId = idempotencyKey
      ? flashMentoringStableId_('audit', [idempotencyKey])
      : Utilities.getUuid();
    var existing = repositories.AUDIT_LOG.listAll().filter(function(event) {
      return String(event.eventId) === String(eventId);
    })[0];
    if (existing) return existing;

    var event = {
      eventId: eventId,
      actorPersonId: actorPersonId == null ? '' : String(actorPersonId),
      action: String(action || 'UNKNOWN_ACTION'),
      entityName: String(entityName || 'SYSTEM'),
      entityId: entityId == null ? '' : String(entityId),
      metadataJson: JSON.stringify(sanitizeFlashMentoringAuditMetadata_(metadata)),
      createdAt: new Date().toISOString()
    };
    repositories.AUDIT_LOG.appendMany([event]);
    return event;
  } catch (error) {
    // Keep operational logs free of request content and raw exception messages.
    Logger.log('FLASH_MENTORING_AUDIT_WRITE_FAILED');
    return null;
  }
}
