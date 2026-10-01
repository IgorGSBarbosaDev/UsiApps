/**
 * Gera uma shortlist de domínio, sem ler/escrever Sheets e sem comunicar pessoas.
 *
 * Contrato:
 * person: registro localizado na Base Mestre vigente, com wcBc, cluster, descricaoNivel1,
 *   role e, quando disponível, directManagerId. O campo active é opcional; false indica inatividade.
 * request: { topic: String } com um tema da taxonomia cadastrada.
 * mentors: [{ id, active, talentApproved, topics, seniority, industrialExperience,
 *   name, role, cluster, area }]. seniority usa C2, C3 ou níveis superiores.
 * availableCapacityByMentorId: mapa { [mentorId]: Number } de slots disponíveis.
 * excludedMentorIds: IDs excluídos somente para esta solicitação.
 *
 * Campos estruturados de senioridade e vivência industrial podem ordenar opções.
 * Texto livre, cadeia CEO 1...n e uso recente não entram no cálculo.
 */
function generateFlashMentoringShortlist_(
  person,
  request,
  mentors,
  availableCapacityByMentorId,
  excludedMentorIds
) {
  var eligibility = evaluateFlashMentoringEligibility_(person);
  if (eligibility.eligible !== true) {
    return flashMentoringTalentReviewResult_(eligibility.reasonCodes, eligibility.eligible);
  }

  if (!eligibility.seniorityPreference) {
    var profileCode = normalizeFlashMentoringValue_(person.descricaoNivel1)
      ? 'MENTEE_MATCH_PROFILE_UNMAPPED'
      : 'MENTEE_MATCH_PROFILE_MISSING';
    return flashMentoringTalentReviewResult_([profileCode], true);
  }

  if (!request || typeof request !== 'object'
      || typeof request.topic !== 'string'
      || !normalizeFlashMentoringValue_(request.topic)) {
    return flashMentoringTalentReviewResult_(['REQUEST_TOPIC_MISSING'], true);
  }

  if (!Array.isArray(mentors)) {
    return flashMentoringTalentReviewResult_(['MENTOR_POOL_MISSING'], true);
  }
  if (!availableCapacityByMentorId
      || typeof availableCapacityByMentorId !== 'object'
      || Array.isArray(availableCapacityByMentorId)) {
    return flashMentoringTalentReviewResult_(['MENTOR_CAPACITY_DATA_MISSING'], true);
  }
  if (!Array.isArray(excludedMentorIds)) {
    return flashMentoringTalentReviewResult_(['EXCLUDED_MENTOR_IDS_MISSING'], true);
  }

  var normalizedExcludedIds = [];
  for (var excludedIndex = 0; excludedIndex < excludedMentorIds.length; excludedIndex += 1) {
    var excludedId = flashMentoringIdentifier_(excludedMentorIds[excludedIndex]);
    if (!excludedId) {
      return flashMentoringTalentReviewResult_(['EXCLUDED_MENTOR_IDS_INVALID'], true);
    }
    normalizedExcludedIds.push(excludedId);
  }

  var directManagerId = '';
  if (flashMentoringHasValue_(person.directManagerId)) {
    directManagerId = flashMentoringIdentifier_(person.directManagerId);
    if (!directManagerId) {
      return flashMentoringTalentReviewResult_(['PERSON_MANAGER_ID_INVALID'], true);
    }
  }

  var requestedTopic = normalizeFlashMentoringValue_(request.topic);
  var dataIssues = [];
  var candidates = [];

  for (var mentorIndex = 0; mentorIndex < mentors.length; mentorIndex += 1) {
    var mentor = mentors[mentorIndex];
    if (!mentor || typeof mentor !== 'object' || Array.isArray(mentor)) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_RECORD_INVALID');
      continue;
    }

    if (mentor.talentApproved === false || mentor.active === false) continue;
    if (typeof mentor.talentApproved !== 'boolean') {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_TALENT_APPROVAL_MISSING');
      continue;
    }
    if (typeof mentor.active !== 'boolean') {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_ACTIVE_STATUS_MISSING');
      continue;
    }

    if (!Array.isArray(mentor.topics)) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_TOPICS_MISSING');
      continue;
    }

    var mentorTopics = [];
    var invalidTopic = false;
    for (var topicIndex = 0; topicIndex < mentor.topics.length; topicIndex += 1) {
      if (typeof mentor.topics[topicIndex] !== 'string'
          || !normalizeFlashMentoringValue_(mentor.topics[topicIndex])) {
        invalidTopic = true;
        break;
      }
      mentorTopics.push(normalizeFlashMentoringValue_(mentor.topics[topicIndex]));
    }
    if (invalidTopic) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_TOPICS_INVALID');
      continue;
    }
    if (mentorTopics.indexOf(requestedTopic) < 0) continue;

    var mentorId = flashMentoringIdentifier_(mentor.id);
    if (!mentorId) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_ID_MISSING');
      continue;
    }
    if (normalizedExcludedIds.indexOf(mentorId) >= 0
        || (directManagerId && mentorId === directManagerId)) {
      continue;
    }

    if (!Object.prototype.hasOwnProperty.call(availableCapacityByMentorId, mentorId)) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_CAPACITY_MISSING');
      continue;
    }
    var availableCapacity = availableCapacityByMentorId[mentorId];
    if (typeof availableCapacity !== 'number'
        || !isFinite(availableCapacity)
        || Math.floor(availableCapacity) !== availableCapacity
        || availableCapacity < 0) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_CAPACITY_INVALID');
      continue;
    }
    if (availableCapacity < 1) continue;

    var seniority = normalizeFlashMentoringMentorSeniority_(mentor.seniority);
    if (seniority === 'BELOW_C2') continue;
    if (!seniority) {
      addFlashMentoringReasonCode_(dataIssues, 'MENTOR_SENIORITY_MISSING');
      continue;
    }

    var reasonCodes = [
      'MATCHING_TOPIC',
      'MENTOR_TALENT_APPROVED',
      'MENTOR_ACTIVE',
      'CAPACITY_AVAILABLE'
    ];
    if (directManagerId) reasonCodes.push('NOT_DIRECT_MANAGER');
    var seniorityPreferred = seniority === eligibility.seniorityPreference.preferredSeniority;
    reasonCodes.push(seniorityPreferred ? 'SENIORITY_PREFERRED' : 'SENIORITY_ALTERNATIVE');

    var hasIndustrialExperience = mentor.industrialExperience === true;
    if (eligibility.seniorityPreference.preferIndustrialExperience
        && seniorityPreferred
        && hasIndustrialExperience) {
      reasonCodes.push('INDUSTRIAL_EXPERIENCE_PREFERRED');
    }

    candidates.push({
      mentorId: mentorId,
      mentor: mentor,
      seniority: seniority,
      availableCapacity: availableCapacity,
      reasonCodes: reasonCodes,
      seniorityPriority: seniorityPreferred ? 0 : 1,
      industrialExperiencePriority:
        eligibility.seniorityPreference.preferIndustrialExperience
          && seniorityPreferred
          && hasIndustrialExperience ? 0 : 1,
      inputOrder: mentorIndex
    });
  }

  if (dataIssues.length) {
    return flashMentoringTalentReviewResult_(dataIssues, true);
  }
  if (!candidates.length) {
    return flashMentoringTalentReviewResult_(['NO_ELIGIBLE_MENTORS'], true);
  }

  candidates.sort(function(a, b) {
    if (a.seniorityPriority !== b.seniorityPriority) {
      return a.seniorityPriority - b.seniorityPriority;
    }
    if (a.industrialExperiencePriority !== b.industrialExperiencePriority) {
      return a.industrialExperiencePriority - b.industrialExperiencePriority;
    }
    return a.inputOrder - b.inputOrder;
  });

  var recommendations = candidates.slice(0, 3).map(function(candidate) {
    return {
      mentorId: candidate.mentorId,
      name: flashMentoringTextValue_(candidate.mentor.name),
      role: flashMentoringTextValue_(candidate.mentor.role),
      cluster: flashMentoringTextValue_(candidate.mentor.cluster),
      area: flashMentoringTextValue_(candidate.mentor.area),
      seniority: candidate.seniority,
      availableCapacity: candidate.availableCapacity,
      reasonCodes: candidate.reasonCodes
    };
  });

  return {
    status: 'SHORTLIST_READY',
    eligible: true,
    nextAction: 'RH_REVIEW',
    reasonCodes: [],
    recommendations: recommendations
  };
}

function flashMentoringTalentReviewResult_(reasonCodes, eligible) {
  return {
    status: 'TALENT_REVIEW_REQUIRED',
    eligible: eligible,
    nextAction: 'TALENT_REVIEW',
    reasonCodes: uniqueFlashMentoringReasonCodes_(reasonCodes),
    recommendations: []
  };
}

function normalizeFlashMentoringMentorSeniority_(value) {
  var seniority = normalizeFlashMentoringValue_(value).replace(/\s+/g, '');
  if (seniority === 'C2') return 'C2';
  if (seniority === 'C3+' || seniority === 'C3PLUS') return 'C3+';
  if (/^C(?:[3-9]|\d{2,})$/.test(seniority)) return 'C3+';
  if (/^C[01]$/.test(seniority)) return 'BELOW_C2';
  return '';
}

function flashMentoringIdentifier_(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim();
}

function flashMentoringHasValue_(value) {
  return value !== undefined
    && value !== null
    && !(typeof value === 'string' && value.trim() === '');
}

function flashMentoringTextValue_(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function addFlashMentoringReasonCode_(reasonCodes, code) {
  if (reasonCodes.indexOf(code) < 0) reasonCodes.push(code);
}

function uniqueFlashMentoringReasonCodes_(reasonCodes) {
  var uniqueCodes = [];
  (reasonCodes || []).forEach(function(code) {
    if (code && uniqueCodes.indexOf(code) < 0) uniqueCodes.push(code);
  });
  return uniqueCodes;
}