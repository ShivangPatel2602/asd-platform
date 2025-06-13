import React, { useState } from "react";
import "./DeleteModal.css";

const DeleteModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  publications,
  isMultiSelect = false,
  isAuthorized = false,
}) => {
  const [selectedPublications, setSelectedPublications] = useState([]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedPublications);
    setSelectedPublications([]);
  };

  if (!isAuthorized) {
    return (
      <div className="delete-modal-overlay">
        <div className="delete-modal">
          <div className="delete-modal-header">
            <span className="delete-warning-icon">🔒</span>
            <h3>Unauthorized Access</h3>
          </div>
          <div className="delete-modal-content">
            <p>
              You are not authorized to delete entries. Please contact an
              administrator for assistance.
            </p>
          </div>
          <div className="delete-modal-actions">
            <button className="delete-cancel-btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handlePublicationSelect = (publication) => {
    setSelectedPublications((prev) => {
      if (prev.includes(publication)) {
        return prev.filter((p) => p !== publication);
      }
      return [...prev, publication];
    });
  };

  return (
    <div className="delete-modal-overlay">
      <div className="delete-modal">
        <div className="delete-modal-header">
          <span className="delete-warning-icon">⚠️</span>
          <h3>{title}</h3>
        </div>
        <div className="delete-modal-content">
          <p>{message}</p>
          {isMultiSelect && publications && publications.length > 0 && (
            <div className="publication-checkbox-list">
              {publications.map((pub, index) => (
                <div key={index} className="publication-checkbox-item">
                  <input
                    type="checkbox"
                    id={`pub-${index}`}
                    className="publication-checkbox"
                    checked={selectedPublications.includes(pub)}
                    onChange={() => handlePublicationSelect(pub)}
                  />
                  <label
                    htmlFor={`pub-${index}`}
                    className="publication-checkbox-label"
                  >
                    {`${pub.author}, ${pub.journal} ${pub.year}`}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="delete-modal-actions">
          <button className="delete-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="delete-confirm-btn"
            onClick={handleConfirm}
            disabled={isMultiSelect && selectedPublications.length === 0}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
