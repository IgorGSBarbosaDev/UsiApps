/**
 * Avalia somente regras de domínio da pessoa mentorada.
 *
 * Contrato recebido do controller/service chamador:
 * person = {
 *   active?: Boolean,
 *   wcBc: "WC" | "BC",
 *   cluster: String,
 *   descricaoNivel1: String,
 *   role: String,
 *   directManagerId: String | Number
 * }
 *
 * A pessoa precisa vir previamente localizada na Base Mestre vigente. Se active vier como false, o registro é encaminhado para revisão. Esta função não
 * consulta planilhas nem envia mensagens.
 */
function evaluateFlashMentoringEligibility_(person) {
  if (!person || typeof person !== 'object' || Array.isArray(person)) {
    return flashMentoringEligibilityResult_(null, ['PERSON_DATA_MISSING'], '', null);
  }

  if (person.active === false) {
    return flashMentoringEligibilityResult_(false, ['PERSON_NOT_ACTIVE'], '', null);
  }
  if (person.active !== undefined && person.active !== true) {
    return flashMentoringEligibilityResult_(null, ['PERSON_ACTIVE_STATUS_INVALID'], '', null);
  }

  var audience = normalizeFlashMentoringValue_(person.wcBc);
  if (!audience) {
    return flashMentoringEligibilityResult_(null, ['PERSON_AUDIENCE_MISSING'], '', null);
  }

  if (audience === 'WC') {
    var cluster = normalizeFlashMentoringValue_(person.cluster);
    if (!cluster) {
      return flashMentoringEligibilityResult_(null, ['PERSON_CLUSTER_MISSING'], '', null);
    }
    if (cluster !== 'C1') {
      return flashMentoringEligibilityResult_(false, ['MENTEE_NOT_ELIGIBLE'], '', null);
    }

    var wcPreference = getFlashMentoringSeniorityPreference_(
      audience,
      normalizeFlashMentoringValue_(person.descricaoNivel1)
    );
    return flashMentoringEligibilityResult_(
      true,
      ['MENTEE_WC_CLUSTER_1'],
      wcPreference ? wcPreference.profileCode : '',
      wcPreference
    );
  }

  if (audience === 'BC') {
    var role = normalizeFlashMentoringValue_(person.role);
    if (!role) {
      return flashMentoringEligibilityResult_(null, ['PERSON_ROLE_MISSING'], '', null);
    }
    if (!isFlashMentoringBcCoordinatorOrSupervisor_(role)) {
      return flashMentoringEligibilityResult_(false, ['MENTEE_NOT_ELIGIBLE'], '', null);
    }

    var bcPreference = getFlashMentoringSeniorityPreference_(
      audience,
      normalizeFlashMentoringValue_(person.descricaoNivel1)
    );
    return flashMentoringEligibilityResult_(
      true,
      ['MENTEE_BC_COORDINATOR_OR_SUPERVISOR'],
      bcPreference ? bcPreference.profileCode : '',
      bcPreference
    );
  }

  return flashMentoringEligibilityResult_(false, ['PERSON_AUDIENCE_UNSUPPORTED'], '', null);
}

function flashMentoringEligibilityResult_(eligible, reasonCodes, profileCode, seniorityPreference) {
  return {
    eligible: eligible,
    status: eligible === true ? 'ELIGIBLE' : 'TALENT_REVIEW_REQUIRED',
    nextAction: eligible === true ? 'CONTINUE_MATCHING' : 'TALENT_REVIEW',
    profileCode: profileCode || '',
    seniorityPreference: seniorityPreference || null,
    reasonCodes: reasonCodes
  };
}

function getFlashMentoringSeniorityPreference_(audience, descricaoNivel1) {
  if (audience === 'BC' && descricaoNivel1 === 'GESTORES') {
    return {
      profileCode: 'BC_COORDINATOR_OR_SUPERVISOR',
      preferredSeniority: 'C2',
      alternativeSeniority: 'C3+',
      preferIndustrialExperience: true
    };
  }

  if (audience !== 'WC') return null;

  if ([
    'TECNICOS',
    'TECNICO',
    'ADMINISTRATIVOS',
    'ADMINISTRATIVO',
    'OUTROS CARGOS',
    'OPERACIONAIS',
    'OPERACIONAL'
  ].indexOf(descricaoNivel1) >= 0) {
    return {
      profileCode: 'WC_C1_INITIAL',
      preferredSeniority: 'C2',
      alternativeSeniority: 'C3+',
      preferIndustrialExperience: false
    };
  }

  if ([
    'TRAINEE',
    'ANALISTAS',
    'ANALISTA',
    'ENGENHEIROS',
    'ENGENHEIRO',
    'SUPERIOR'
  ].indexOf(descricaoNivel1) >= 0) {
    return {
      profileCode: 'WC_C1_TRAINEE_ANALYST_ENGINEER',
      preferredSeniority: 'C3+',
      alternativeSeniority: 'C2',
      preferIndustrialExperience: false
    };
  }

  if (['GESTORES', 'ESPECIALISTAS', 'ESPECIALISTA'].indexOf(descricaoNivel1) >= 0) {
    return {
      profileCode: 'WC_C1_COORDINATOR_SPECIALIST',
      preferredSeniority: 'C3+',
      alternativeSeniority: 'C2',
      preferIndustrialExperience: false
    };
  }

  return null;
}

function isFlashMentoringBcCoordinatorOrSupervisor_(role) {
  return /(^|[^A-Z])COORDENADOR(?:A|ES)?($|[^A-Z])/.test(role)
    || /(^|[^A-Z])SUPERVISOR(?:A|ES)?($|[^A-Z])/.test(role);
}

function normalizeFlashMentoringValue_(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}