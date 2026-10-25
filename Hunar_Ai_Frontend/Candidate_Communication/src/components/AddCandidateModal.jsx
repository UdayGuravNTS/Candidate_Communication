import React, { useState } from 'react';
import { CloseIcon } from './Icons';

const validateCandidateName = (name) => {
  if (!name.trim()) return 'Candidate name is required.';
  if (!/^\p{L}+(?:\s+\p{L}+)*$/u.test(name.trim())) {
    return 'Use letters and spaces only.';
  }
  return '';
};

const validateMobileNumber = (mobileNumber) => {
  if (!mobileNumber) return 'Mobile number is required.';
  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    return 'Enter a valid 10-digit Indian mobile number starting with 6-9.';
  }
  return '';
};

const validateEmail = (email) => {
  if (!email.trim()) return 'Email is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return 'Enter a valid email address, for example name@example.com.';
  }
  return '';
};

export default function AddCandidateModal({ isOpen, onClose, onAdd }) {
  const [candidateName, setCandidateName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isCandidateNameValid = !validateCandidateName(candidateName);
  const isMobileNumberValid = !validateMobileNumber(mobileNumber);
  const isEmailValid = !validateEmail(email);
  const isFormValid =
    isCandidateNameValid && isMobileNumberValid && isEmailValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = {
      candidateName: validateCandidateName(candidateName),
      mobileNumber: validateMobileNumber(mobileNumber),
      email: validateEmail(email)
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) {
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onAdd({
        fullName: candidateName,
        mobileNumber: `+91 ${mobileNumber}`,
        email: email.trim()
      });
      handleClose(true);
    } catch (submitError) {
      setSubmitError(
        submitError instanceof Error ? submitError.message : 'Unable to add candidate.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (force = false) => {
    if (isSubmitting && !force) return;
    setCandidateName('');
    setMobileNumber('');
    setEmail('');
    setFieldErrors({});
    setSubmitError('');
    onClose();
  };

  const updateFieldError = (field, value, validator) => {
    if (fieldErrors[field]) {
      setFieldErrors((previous) => ({ ...previous, [field]: validator(value) }));
    }
    if (submitError) setSubmitError('');
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="add-candidate-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="add-candidate-modal-header">
          <h2 className="add-candidate-modal-title">Add Candidate</h2>
          <button
            type="button"
            className="add-candidate-close-btn"
            onClick={handleClose}
            aria-label="Close"
            disabled={isSubmitting}
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {submitError && <div className="add-candidate-error-banner" role="alert">{submitError}</div>}

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="add-candidate-form">
          <div className="add-candidate-inputs-group">
            {/* Candidate Name Input */}
            <div className="custom-input-field">
              <input
                type="text"
                className="modal-text-input"
                value={candidateName}
                disabled={isSubmitting}
                required
                maxLength={100}
                aria-label="Candidate Name"
                aria-invalid={Boolean(fieldErrors.candidateName)}
                aria-describedby={fieldErrors.candidateName ? 'candidate-name-error' : undefined}
                onChange={(e) => {
                  const normalizedName = e.target.value
                    .replace(/\s+/g, ' ')
                    .trimStart();
                  const formattedName = normalizedName
                    ? `${normalizedName[0].toLocaleUpperCase()}${normalizedName.slice(1)}`
                    : '';
                  setCandidateName(formattedName);
                  updateFieldError('candidateName', formattedName, validateCandidateName);
                }}
                onBlur={() =>
                  setFieldErrors((previous) => ({
                    ...previous,
                    candidateName: validateCandidateName(candidateName)
                  }))
                }
                autoFocus
              />
              {!candidateName && (
                <div className="custom-placeholder" pointer-events="none">
                  Candidate Name <span className="required-asterisk">*</span>
                </div>
              )}
              {fieldErrors.candidateName && (
                <p id="candidate-name-error" className="candidate-field-error" role="alert">
                  {fieldErrors.candidateName}
                </p>
              )}
            </div>

            {/* Moblie Number Input */}
            <div className="custom-input-field">
              <input
                type="tel"
                className="modal-text-input"
                value={mobileNumber}
                disabled={isSubmitting}
                required
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                aria-label="Indian mobile number"
                aria-invalid={Boolean(fieldErrors.mobileNumber)}
                aria-describedby={fieldErrors.mobileNumber ? 'mobile-number-error' : undefined}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setMobileNumber(value);
                  updateFieldError('mobileNumber', value, validateMobileNumber);
                }}
                onBlur={() =>
                  setFieldErrors((previous) => ({
                    ...previous,
                    mobileNumber: validateMobileNumber(mobileNumber)
                  }))
                }
              />
              {!mobileNumber && (
                <div className="custom-placeholder" pointer-events="none">
                  Moblie Number <span className="required-asterisk">*</span>
                </div>
              )}
              {fieldErrors.mobileNumber && (
                <p id="mobile-number-error" className="candidate-field-error" role="alert">
                  {fieldErrors.mobileNumber}
                </p>
              )}
            </div>

            {/* Email Input */}
            <div className="custom-input-field">
              <input
                type="email"
                className="modal-text-input"
                value={email}
                disabled={isSubmitting}
                required
                maxLength={254}
                autoComplete="email"
                aria-label="Email"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={fieldErrors.email ? 'candidate-email-error' : undefined}
                onChange={(e) => {
                  setEmail(e.target.value);
                  updateFieldError('email', e.target.value, validateEmail);
                }}
                onBlur={() =>
                  setFieldErrors((previous) => ({
                    ...previous,
                    email: validateEmail(email)
                  }))
                }
              />
              {!email && (
                <div className="custom-placeholder" pointer-events="none">
                  Email <span className="required-asterisk">*</span>
                </div>
              )}
              {fieldErrors.email && (
                <p id="candidate-email-error" className="candidate-field-error" role="alert">
                  {fieldErrors.email}
                </p>
              )}
            </div>
          </div>

          {/* Modal Footer / Action Buttons */}
          <div className="add-candidate-modal-footer">
            <button
              type="button"
              className="btn-modal-cancel add-candidate-cancel"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              CANCEL
            </button>
            <button
              type="submit"
              className={`btn-modal-submit ${isFormValid ? 'btn-modal-submit-active' : 'btn-modal-submit-disabled'}`}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? 'ADDING...' : 'ADD CANDIDATE'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
