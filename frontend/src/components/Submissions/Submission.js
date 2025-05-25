import React, { useState, useEffect } from "react";
import Navbar from "../Navbar/Navbar";
import config from "../../config";
import "./Submission.css";

const SubmissionReview = ({ setUser, isAuthorized }) => {
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [comments, setComments] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/pending-submissions`,
        {
          credentials: "include",
        }
      );
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    }
  };

  const handleAction = async (action) => {
    if (action === "reject" && !comments.trim()) {
      setStatus("Comments are required for rejection");
      return;
    }

    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/submissions/${selectedSubmission._id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            action,
            comments,
          }),
        }
      );

      if (response.ok) {
        setStatus(`Submission ${action}d successfully`);
        setSelectedSubmission(null);
        setComments("");
        fetchSubmissions();
      }
    } catch (error) {
      setStatus("Error processing submission");
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} />
      <div className="submissions-page">
        <div className="submissions-sidebar">
          <h2>Pending Submissions</h2>
          {submissions.length === 0 ? (
            <div className="no-submissions">
              <p>No pending submissions</p>
            </div>
          ) : (
            <div className="submission-list">
              {submissions.map((sub) => (
                <div
                  key={sub._id}
                  className={`submission-item ${
                    selectedSubmission?._id === sub._id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedSubmission(sub)}
                >
                  <h3>
                    {sub.data.element} - {sub.data.material}
                  </h3>
                  <p>By: {sub.submitter.name}</p>
                  <p>Author: {sub.data.publication.author}</p>
                  {sub.data.publication.doi && (
                    <p className="doi-link">DOI: {sub.data.publication.doi}</p>
                  )}
                  <p className="submission-date">
                    {new Date(sub.submission_date).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="submission-details">
          {selectedSubmission ? (
            <>
              <h2>Review Submission</h2>
              <div className="submission-data">
                <div className="data-section">
                  <h3>Material Information</h3>
                  <p>
                    <strong>Element:</strong> {selectedSubmission.data.element}
                  </p>
                  <p>
                    <strong>Material:</strong>{" "}
                    {selectedSubmission.data.material}
                  </p>
                </div>

                <div className="data-section">
                  <h3>Process Parameters</h3>
                  <p>
                    <strong>Precursor:</strong>{" "}
                    {selectedSubmission.data.precursor}
                  </p>
                  <p>
                    <strong>Co-reactant:</strong>{" "}
                    {selectedSubmission.data.coreactant}
                  </p>
                  <p>
                    <strong>Temperature:</strong>{" "}
                    {selectedSubmission.data.temperature}°C
                  </p>
                </div>

                <div className="data-section">
                  <h3>Surface Details</h3>
                  <p>
                    <strong>Surface:</strong> {selectedSubmission.data.surface}
                  </p>
                  <p>
                    <strong>Pretreatment:</strong>{" "}
                    {selectedSubmission.data.pretreatment}
                  </p>
                </div>

                <div className="data-section">
                  <h3>Publication</h3>
                  <p>
                    <strong>Author:</strong>{" "}
                    {selectedSubmission.data.publication.author}
                  </p>
                  {selectedSubmission.data.publication.doi && (
                    <p>
                      <strong>DOI:</strong>{" "}
                      <a
                        href={`https://doi.org/${selectedSubmission.data.publication.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {selectedSubmission.data.publication.doi}
                      </a>
                    </p>
                  )}
                </div>

                <div className="data-section">
                  <h3>Readings</h3>
                  <div className="readings-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Cycles</th>
                          <th>Thickness (Å)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSubmission.data.readings.map(
                          (reading, idx) => (
                            <tr key={idx}>
                              <td>{reading.cycles}</td>
                              <td>{reading.thickness}</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="review-section">
                  <textarea
                    placeholder="Add comments (required for rejection)"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                  />
                  <div className="action-buttons">
                    <button
                      className="approve-btn"
                      onClick={() => handleAction("approve")}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      onClick={() => handleAction("reject")}
                      disabled={!comments.trim()}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="no-selection">
              <p>Select a submission to review</p>
            </div>
          )}
        </div>
      </div>

      {status && (
        <div
          className={`status-message ${
            status.includes("Error") ? "error" : "success"
          }`}
        >
          {status}
        </div>
      )}
    </>
  );
};

export default SubmissionReview;
