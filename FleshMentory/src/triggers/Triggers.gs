/**
 * Manual installable time-trigger entrypoints. No trigger is created here.
 * Notification processing only records a blocked delivery attempt while real
 * email delivery remains disabled.
 */
function processFlashMentoringFollowUpsTrigger_() {
  try {
    return processFlashMentoringFollowUps_(new Date());
  } catch (error) {
    reportFlashMentoringAutomationFailure_('FOLLOW_UP_PROCESSING_FAILED', 'FOLLOW_UP');
    return { failed: true, processed: 0 };
  }
}

function processFlashMentoringNotificationQueueTrigger_() {
  try {
    return processFlashMentoringNotificationQueue_(new Date());
  } catch (error) {
    reportFlashMentoringAutomationFailure_('NOTIFICATION_QUEUE_PROCESSING_FAILED', 'NOTIFICATION_OUTBOX');
    return { failed: true, processed: 0 };
  }
}

function runFlashMentoringAutomation_() {
  return {
    followUps: processFlashMentoringFollowUpsTrigger_(),
    notifications: processFlashMentoringNotificationQueueTrigger_(),
    emailDeliveryEnabled: false
  };
}

function reportFlashMentoringAutomationFailure_(reasonCode, entityName) {
  recordFlashMentoringAudit_('', 'AUTOMATION_HANDLER_FAILED', entityName, 'SYSTEM', {
    reasonCode: reasonCode
  });
  try {
    queueFlashMentoringTalentReview_(entityName, 'SYSTEM', reasonCode,
      'AUTOMATION_FAILURE:' + entityName + ':' + reasonCode);
  } catch (error) {
    Logger.log('FLASH_MENTORING_AUTOMATION_FAILURE_REVIEW_QUEUE_FAILED');
  }
  Logger.log('FLASH_MENTORING_AUTOMATION_HANDLER_FAILED');
}
