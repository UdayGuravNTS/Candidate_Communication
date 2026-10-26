import React, { useEffect, useState, useMemo } from 'react';
import { CloseIcon } from './Icons';
import { FiClock, FiSend, FiFileText, FiUser, FiInfo, FiLayers, FiAlertCircle, FiMail } from 'react-icons/fi';
import CandidateApi from '../services/candidateApi';

const CHANNEL_PROVIDERS = {
  Email: { name: 'Gmail SMTP Service', badge: 'Transactional Mail', desc: 'Direct email delivery to candidate inbox' }
};

const CANDIDATE_COMMUNICATION_TEMPLATES = [
  {
    id: 'tpl_screening_1',
    title: 'Initial Screening Call Invitation',
    category: 'Application & Screening',
    body: 'Hi {first_name},\n\nWe came across your profile for the {role} position and would like to schedule a brief 15-minute introductory call to learn more about your background.\n\nPlease let us know your availability over the next two business days.\n\nBest regards,\nHunar AI Recruitment Team'
  },
  {
    id: 'tpl_screening_2',
    title: 'Application Received & Under Review',
    category: 'Application & Screening',
    body: 'Hello {candidate_name},\n\nThank you for applying for the {role} position at Hunar AI (Candidate ID: {candidate_id}).\n\nOur recruitment team has received your application and is currently reviewing your profile. We will update you on the next steps shortly.\n\nBest regards,\nHunar AI Talent Acquisition'
  },
  {
    id: 'tpl_interview_1',
    title: 'Interview Invitation - First Round',
    category: 'Interview Scheduling',
    body: 'Dear {candidate_name},\n\nThank you for your interest in the {role} position at Hunar AI. We were impressed by your profile and would love to invite you for a first-round interview.\n\nPlease reply with your preferred days and time slots over the coming week so we can schedule the call.\n\nWarm regards,\nHunar AI Recruitment Team'
  },
  {
    id: 'tpl_interview_2',
    title: 'Technical Assessment Round',
    category: 'Assessments',
    body: 'Hi {candidate_name},\n\nCongratulations on progressing to the assessment round for the {role} role at Hunar AI.\n\nPlease complete the technical skills assessment within the next 48 hours. Ensure you have a quiet environment and good internet connection.\n\nBest of luck!\nHunar AI Hiring Team'
  },
  {
    id: 'tpl_interview_3',
    title: 'Final Interview with Leadership',
    category: 'Interview Scheduling',
    body: 'Dear {candidate_name},\n\nCongratulations on clearing the previous evaluation rounds! We would like to invite you for the final discussion for the {role} position with our leadership team.\n\nPlease let us know your availability over the next couple of days.\n\nBest regards,\nHunar AI Leadership Team'
  },
  {
    id: 'tpl_interview_4',
    title: 'Interview Reminder',
    category: 'Interview Scheduling',
    body: 'Hi {first_name},\n\nThis is a quick reminder for your upcoming interview for the {role} position scheduled for tomorrow.\n\nPlease ensure your camera and microphone are ready. If you need to reschedule or have any questions beforehand, feel free to reply to this email.\n\nBest of luck,\nHunar AI Recruitment Team'
  },
  {
    id: 'tpl_offer_1',
    title: 'Job Offer Discussion',
    category: 'Job Offer & Onboarding',
    body: 'Dear {candidate_name},\n\nWe are thrilled to inform you that you have been selected for the {role} position at Hunar AI!\n\nWe would love to schedule a call to walk you through your official offer details, compensation package, and tentative start date. Please let us know your availability today or tomorrow.\n\nWarmest congratulations,\nHunar AI Recruitment Team'
  },
  {
    id: 'tpl_offer_2',
    title: 'Document Verification & Pre-Onboarding',
    category: 'Job Offer & Onboarding',
    body: 'Hi {candidate_name},\n\nCongratulations on your selection for the {role} position!\n\nTo proceed with your onboarding and verification, please share soft copies of your ID proof, educational certificates, and previous experience documents within 3 business days.\n\nWelcome to Hunar AI,\nHR Operations Team'
  },
  {
    id: 'tpl_status_1',
    title: 'Application Follow-Up / Status Update',
    category: 'Status Updates',
    body: 'Dear {candidate_name},\n\nWe wanted to provide you with a quick update on your candidacy for the {role} position. Our hiring team is completing candidate evaluations and will share an update by the end of this week.\n\nThank you for your patience,\nHunar AI Talent Team'
  },
  {
    id: 'tpl_status_2',
    title: 'Polite Rejection / Talent Pool',
    category: 'Status Updates',
    body: 'Dear {candidate_name},\n\nThank you for taking the time to interview for the {role} position at Hunar AI. While we were impressed with your background, we have decided to move forward with another candidate whose experience more closely matches our current needs.\n\nWe will keep your profile in our talent pool for future openings and wish you the best in your job search.\n\nSincerely,\nHunar AI Talent Acquisition'
  }
];

const VARIABLE_TAGS = [
  { tag: '{candidate_name}', label: 'Full Name' },
  { tag: '{first_name}', label: 'First Name' },
  { tag: '{role}', label: 'Role' },
  { tag: '{candidate_id}', label: 'Candidate ID' },
  { tag: '{phone}', label: 'Phone' },
  { tag: '{email}', label: 'Email' }
];

export default function SendMessageModal({
  isOpen,
  onClose,
  selectedCandidates,
  onSend,
  isSending = false,
  templates = [],
  onReloadTemplates,
  providerHealth
}) {
  const [message, setMessage] = useState('');
  const selectedChannel = 'Email';
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [saveTemplateError, setSaveTemplateError] = useState('');

  // Merge available templates with candidate communication templates fallback
  const allTemplates = useMemo(() => {
    if (templates && templates.length > 0) {
      return templates;
    }
    return CANDIDATE_COMMUNICATION_TEMPLATES;
  }, [templates]);

  // Group templates by candidate communication category
  const groupedTemplates = useMemo(() => {
    const groups = {};
    allTemplates.forEach((tpl) => {
      const cat = tpl.category || 'General';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(tpl);
    });
    return groups;
  }, [allTemplates]);

  // Default scheduled time: tomorrow at 10:00 AM
  useEffect(() => {
    if (isOpen) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      const iso = tomorrow.toISOString().slice(0, 16);
      setScheduledDateTime(iso);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSending) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSending]);

  const handleClose = (force = false) => {
    if (isSending && !force) return;
    setMessage('');
    setSelectedTemplateId('');
    setIsScheduled(false);
    setShowPreview(false);
    setIsSavingTemplate(false);
    setNewTemplateTitle('');
    setSaveTemplateError('');
    onClose();
  };

  // Handle template selection
  const handleSelectTemplate = (e) => {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);
    if (!templateId) return;

    const selectedTpl = allTemplates.find((t) => String(t.id) === String(templateId));
    if (selectedTpl) {
      setMessage(selectedTpl.body);
    }
  };

  // Insert variable tag into message at cursor position
  const handleInsertTag = (tag) => {
    setMessage((prev) => (prev ? `${prev} ${tag}` : tag));
  };

  // Save current text as template
  const handleSaveAsTemplate = async () => {
    if (!newTemplateTitle.trim() || !message.trim()) {
      setSaveTemplateError('Please enter a template title and message.');
      return;
    }
    setSaveTemplateError('');
    try {
      await CandidateApi.createTemplate({
        title: newTemplateTitle.trim(),
        body: message.trim(),
        category: 'Custom Templates',
        channel: 'Email'
      });
      if (onReloadTemplates) onReloadTemplates();
      setIsSavingTemplate(false);
      setNewTemplateTitle('');
    } catch (err) {
      setSaveTemplateError(err instanceof Error ? err.message : 'Failed to save template.');
    }
  };

  // Generate personalized preview for the first selected candidate
  // useMemo MUST be called before any conditional early returns (Rules of Hooks)
  const previewText = useMemo(() => {
    if (!message) return '';
    const sample = selectedCandidates[0];
    if (!sample) return message;

    return message
      .replace(/\{candidate_name\}/gi, sample.fullName || 'Candidate')
      .replace(/\{name\}/gi, sample.fullName || 'Candidate')
      .replace(/\{first_name\}/gi, (sample.fullName || 'Candidate').split(' ')[0])
      .replace(/\{role\}/gi, sample.role || 'Candidate')
      .replace(/\{candidate_id\}/gi, sample.id || 'A1B2C1')
      .replace(/\{phone\}/gi, sample.mobileNumber || '+91 9876543210')
      .replace(/\{email\}/gi, sample.email || 'candidate@example.com');
  }, [message, selectedCandidates]);

  // Early return AFTER all hooks
  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!message.trim() || selectedCandidates.length === 0) return;

    if (isScheduled && !scheduledDateTime) {
      alert('Please select a scheduled date and time.');
      return;
    }

    try {
      await onSend({
        channel: 'Email',
        provider: 'Gmail SMTP',
        message: message.trim(),
        candidateIds: selectedCandidates.map((candidate) => candidate.id),
        isScheduled,
        scheduledDate: isScheduled ? new Date(scheduledDateTime).toISOString() : null
      });
      handleClose(true);
    } catch {
      // toast is handled by parent page
    }
  };

  const isDown = providerHealth?.isDown || providerHealth?.status === 'outage';

  return (
    <div className="message-drawer-backdrop" onClick={handleClose}>
      <aside
        className="message-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-message-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="message-drawer-header">
          <h2 id="send-message-title">Send Message</h2>
          <button
            type="button"
            className="message-drawer-close"
            onClick={() => handleClose(false)}
            aria-label="Close send message panel"
            disabled={isSending}
          >
            <CloseIcon size={22} />
          </button>
        </div>

        <form className="message-drawer-form" onSubmit={handleSubmit}>
          {/* Provider Downtime Notice */}
          {isDown && (
            <div className="drawer-outage-alert" role="alert">
              <FiAlertCircle size={16} />
              <div>
                <strong>Communication Provider Service Unavailable</strong>
                <p>Deliveries are temporarily queued. You can still schedule messages or draft them.</p>
              </div>
            </div>
          )}

          {/* Recipients List */}
          <div className="message-drawer-recipients">
            <p className="message-drawer-recipient-count">
              {selectedCandidates.length} Recipient{selectedCandidates.length === 1 ? '' : 's'}
            </p>
            <div className="message-drawer-recipient-list">
              {selectedCandidates.map((candidate) => (
                <span
                  key={candidate.id}
                  className="message-drawer-recipient"
                  title={`${candidate.role} • ${candidate.email || candidate.mobileNumber}`}
                >
                  {candidate.fullName}  
                </span>
              ))}
            </div>
          </div>

          {/* Communication Method */}
          <div className="form-group-section">
            <label className="message-drawer-label">
              Communication Method <span aria-hidden="true">*</span>
            </label>
            <div className="provider-channel-chips">
              <button
                type="button"
                className="provider-chip-btn active"
                style={{ cursor: 'default' }}
                disabled
              >
                <FiMail size={14} style={{ marginRight: 6 }} />
                <span className="chip-name">Email</span>
                <span className="chip-provider-badge">Transactional Mail</span>
              </button>
            </div>
            <p className="message-drawer-hint">
              Routing via <strong>Gmail SMTP</strong> (Direct email delivery to candidate registered email inbox)
            </p>
          </div>

          {/* Message Template Dropdown */}
          <div className="form-group-section">
            <div className="template-label-row">
              <label htmlFor="template-selector" className="message-drawer-label">
                Candidate Communication Template
              </label>
              {!isSavingTemplate && (
                <button
                  type="button"
                  className="btn-link-save-tpl"
                  onClick={() => setIsSavingTemplate(true)}
                  disabled={isSending || !message.trim()}
                >
                  + Save current text as template
                </button>
              )}
            </div>

            <select
              id="template-selector"
              className="template-select-input"
              value={selectedTemplateId}
              onChange={handleSelectTemplate}
              disabled={isSending}
            >
              <option value="">-- Choose a candidate communication template or start typing --</option>
              {Object.entries(groupedTemplates).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.title}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {/* Save Template Inline Card */}
            {isSavingTemplate && (
              <div className="save-template-inline-card">
                <input
                  type="text"
                  placeholder="Template title (e.g. Second Round Interview)"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  className="save-template-input"
                />
                <div className="save-template-actions">
                  <button
                    type="button"
                    className="btn-secondary-sm"
                    onClick={() => {
                      setIsSavingTemplate(false);
                      setSaveTemplateError('');
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary-sm"
                    onClick={handleSaveAsTemplate}
                    disabled={!newTemplateTitle.trim()}
                  >
                    Save Template
                  </button>
                </div>
                {saveTemplateError && <p className="save-template-err">{saveTemplateError}</p>}
              </div>
            )}

            {/* Candidate-specific variables helper */}
            <div className="variable-tags-wrapper">
              <span className="tags-hint">Insert candidate data:</span>
              <div className="variable-tags-list">
                {VARIABLE_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    className="variable-tag-chip"
                    onClick={() => handleInsertTag(item.tag)}
                    title={`Inserts candidate's ${item.label}`}
                    disabled={isSending}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Message Textarea & Live Preview */}
          <div className="message-drawer-message-field">
            <div className="textarea-header-row">
              <label htmlFor="message-body" className="message-drawer-label">
                Message <span aria-hidden="true">*</span>
              </label>
              <button
                type="button"
                className={`btn-preview-toggle ${showPreview ? 'active' : ''}`}
                onClick={() => setShowPreview(!showPreview)}
                disabled={!message.trim()}
              >
                {showPreview ? 'Edit Message' : 'Live Preview'}
              </button>
            </div>
            <p className="message-drawer-hint">Type message or select a template above. Placeholders will automatically personalize for each candidate.</p>

            {showPreview ? (
              <div className="message-preview-box">
                <div className="message-preview-tag">
                  Personalized preview for: <strong>{selectedCandidates[0]?.fullName || 'Candidate'}</strong>
                </div>
                <div className="message-preview-content">{previewText}</div>
              </div>
            ) : (
              <textarea
                id="message-body"
                className="message-drawer-textarea"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Type or paste here... Use {candidate_name}, {role}, etc."
                required
                disabled={isSending}
              />
            )}
          </div>

          {/* Bonus Feature B: Scheduled Messages */}
          <div className="form-group-section schedule-section">
            <label className="message-drawer-label">Delivery Schedule</label>
            <div className="schedule-options-row">
              <label className="schedule-radio-label">
                <input
                  type="radio"
                  name="schedule_mode"
                  checked={!isScheduled}
                  onChange={() => setIsScheduled(false)}
                  disabled={isSending}
                />
                <span>Send Immediately</span>
              </label>
              <label className="schedule-radio-label">
                <input
                  type="radio"
                  name="schedule_mode"
                  checked={isScheduled}
                  onChange={() => setIsScheduled(true)}
                  disabled={isSending}
                />
                <span className="schedule-radio-flex">
                  <FiClock size={14} /> Schedule for Later
                </span>
              </label>
            </div>

            {isScheduled && (
              <div className="schedule-datetime-wrap">
                <label htmlFor="schedule-time-input" className="schedule-time-label">
                  Select Date & Time (Future):
                </label>
                <input
                  id="schedule-time-input"
                  type="datetime-local"
                  value={scheduledDateTime}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledDateTime(e.target.value)}
                  className="schedule-datetime-input"
                  required={isScheduled}
                  disabled={isSending}
                />
                <p className="message-drawer-hint">
                  The system will automatically dispatch the message when the scheduled time arrives.
                </p>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="message-drawer-actions">
            <button
              type="button"
              className="btn-secondary message-drawer-cancel"
              onClick={() => handleClose(false)}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="message-drawer-submit"
              disabled={isSending || !message.trim() || selectedCandidates.length === 0}
            >
              <span>
                {isSending
                  ? 'Processing...'
                  : isScheduled
                  ? 'Schedule Message'
                  : 'Send Message'}
              </span>
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

