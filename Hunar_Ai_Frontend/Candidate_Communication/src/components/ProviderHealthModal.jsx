import React, { useState } from 'react';
import { CloseIcon, CheckIcon, FailedIcon, RefreshIcon } from './Icons';
import { FiActivity, FiServer, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';

export default function ProviderHealthModal({
  isOpen,
  onClose,
  health,
  isLoading,
  onRefresh,
  onToggleOutage,
  isTogglingOutage
}) {
  if (!isOpen) return null;

  const isDown = health?.isDown || health?.status === 'outage';
  const summary = health?.summary || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0, scheduled: 0 };
  const filteredProviders = (health?.providers || []).filter(
    (p) => !['whatsapp', 'sms'].includes(String(p.channel || p.id || '').toLowerCase())
  );
  const providers = filteredProviders.length > 0 ? filteredProviders : [
    {
      id: 'email',
      name: 'Gmail SMTP Email Service',
      channel: 'Email',
      status: isDown ? 'outage' : 'operational',
      latencyMs: isDown ? 0 : 35,
      description: 'Secure Transactional Email Delivery (smtp.gmail.com:587)'
    }
  ];

  return (
    <div className="provider-modal-backdrop" onClick={onClose}>
      <div
        className="provider-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-health-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="provider-modal-header">
          <div className="provider-modal-title-row">
            <FiActivity size={20} className="provider-modal-icon" />
            <h2 id="provider-health-title">Communication Service Health</h2>
          </div>
          <button
            type="button"
            className="provider-modal-close"
            onClick={onClose}
            aria-label="Close provider health modal"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="provider-modal-body">
          {/* Main Status Banner */}
          <div className={`provider-status-banner ${isDown ? 'status-banner-outage' : 'status-banner-operational'}`}>
            <div className="provider-status-pulse-wrap">
              <span className={`provider-status-pulse ${isDown ? 'pulse-red' : 'pulse-green'}`} />
              <span className="provider-status-title">
                {isDown ? 'Outage Detected' : 'Operational'}
              </span>
            </div>
            <p className="provider-status-desc">
              {health?.systemMessage || (isDown ? 'Communication service is down.' : 'All services operational.')}
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="provider-metrics-section">
            <h3 className="provider-section-title">Message Delivery Metrics</h3>
            <div className="provider-metrics-grid">
              <div className="provider-metric-card">
                <span className="metric-label">Messages Sent</span>
                <span className="metric-value metric-sent">{summary.sent}</span>
              </div>
              <div className="provider-metric-card">
                <span className="metric-label">Messages Delivered</span>
                <span className="metric-value metric-delivered">{summary.delivered}</span>
              </div>
              <div className="provider-metric-card">
                <span className="metric-label">Messages Read</span>
                <span className="metric-value metric-read">{summary.read}</span>
              </div>
              <div className="provider-metric-card">
                <span className="metric-label">Messages Scheduled</span>
                <span className="metric-value metric-scheduled">{summary.scheduled}</span>
              </div>
              <div className="provider-metric-card">
                <span className="metric-label">Messages Failed</span>
                <span className="metric-value metric-failed">{summary.failed}</span>
              </div>
            </div>
          </div>

          {/* Email Provider Section */}
          <div className="provider-channels-section">
            <h3 className="provider-section-title">Communication Provider</h3>
            <div className="provider-channels-list">
              {providers.map((p) => {
                const pOutage = p.status === 'outage';
                return (
                  <div key={p.id || p.name} className={`provider-channel-item ${pOutage ? 'channel-item-down' : ''}`}>
                    <div className="provider-channel-info">
                      <div className="provider-channel-name-row">
                        <span className="provider-channel-name">{p.name}</span>
                        <span className="provider-channel-badge">{p.channel}</span>
                      </div>
                      <span className="provider-channel-desc">{p.description}</span>
                    </div>
                    <div className="provider-channel-status-wrap">
                      <span className={`provider-channel-status-pill ${pOutage ? 'pill-down' : 'pill-up'}`}>
                        {pOutage ? 'Down' : 'Operational'}
                      </span>
                      {p.latencyMs > 0 && (
                        <span className="provider-channel-latency">{p.latencyMs}ms</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Outage Simulation / Testing Tool */}
          <div className="provider-simulation-box">
            <div className="provider-simulation-desc">
              <FiServer size={16} />
              <div>
                <strong>Provider Availability Simulation</strong>
                <p>Toggle provider outage mode to test how retry and scheduled delivery mechanisms respond to service interruptions.</p>
              </div>
            </div>
            <button
              type="button"
              className={`btn-outage-toggle ${isDown ? 'btn-restore-service' : 'btn-simulate-outage'}`}
              onClick={() => onToggleOutage(!isDown)}
              disabled={isTogglingOutage}
            >
              {isTogglingOutage
                ? 'Updating...'
                : isDown
                ? 'Restore Service'
                : 'Simulate Provider Outage'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="provider-modal-footer">
          <button
            type="button"
            className="btn-refresh-health"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshIcon size={14} />
            <span>{isLoading ? 'Checking...' : 'Refresh Health'}</span>
          </button>
          <button
            type="button"
            className="btn-primary-modal-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
