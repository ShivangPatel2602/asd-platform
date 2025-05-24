import React, { useState, useEffect } from 'react';
import Navbar from '../Navbar/Navbar';
import config from '../../config';
import './Submission.css';

const SubmissionReview = ({ setUser }) => {
    const [submissions, setSubmissions] = useState([]);
    const [selectedSubmission, setSelectedSubmission] = useState(null);
    const [comments, setComments] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        try {
            const response = await fetch(`${config.BACKEND_API_URL}/api/pending-submissions`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setSubmissions(data);
            }
        } catch (error) {
            console.error('Error fetching submissions:', error);
        }
    };

    const handleSubmissionAction = async (action) => {
        try {
            const response = await fetch(
                `${config.BACKEND_API_URL}/api/submissions/${selectedSubmission._id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        action,
                        comments
                    })
                }
            );

            if (response.ok) {
                setStatus(`Submission ${action}d successfully`);
                setSelectedSubmission(null);
                setComments('');
                fetchSubmissions();
            }
        } catch (error) {
            console.error(`Error ${action}ing submission:`, error);
            setStatus('Error processing submission');
        }
    };

    return (
        <>
            <Navbar setUser={setUser} />
            <div className="submissions-container">
                <h1>Data Submissions Review</h1>
                <div className="submissions-count">
                    Pending Reviews: {submissions.length}
                </div>

                {selectedSubmission ? (
                    <div className="submission-detail">
                        <h2>Review Submission</h2>
                        <div className="submission-info">
                            <p><strong>Submitter:</strong> {selectedSubmission.submitter.name}</p>
                            <p><strong>Date:</strong> {new Date(selectedSubmission.submission_date).toLocaleDateString()}</p>
                        </div>

                        <div className="submission-data">
                            {/* Display all submission data fields */}
                            <h3>Submission Data</h3>
                            <pre>{JSON.stringify(selectedSubmission.data, null, 2)}</pre>
                        </div>

                        <div className="review-actions">
                            <textarea
                                placeholder="Add comments (required for rejection)"
                                value={comments}
                                onChange={(e) => setComments(e.target.value)}
                            />
                            <div className="action-buttons">
                                <button 
                                    className="approve-btn"
                                    onClick={() => handleSubmissionAction('approve')}
                                >
                                    Approve
                                </button>
                                <button 
                                    className="reject-btn"
                                    onClick={() => handleSubmissionAction('reject')}
                                    disabled={!comments.trim()}
                                >
                                    Reject
                                </button>
                                <button 
                                    className="back-btn"
                                    onClick={() => setSelectedSubmission(null)}
                                >
                                    Back to List
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="submissions-list">
                        {submissions.map(submission => (
                            <div 
                                key={submission._id} 
                                className="submission-card"
                                onClick={() => setSelectedSubmission(submission)}
                            >
                                <h3>{submission.submitter.name}</h3>
                                <p>Element: {submission.data.element}</p>
                                <p>Material: {submission.data.material}</p>
                                <p>Date: {new Date(submission.submission_date).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                )}

                {status && (
                    <div className={`status-message ${status.includes('Error') ? 'error' : 'success'}`}>
                        {status}
                    </div>
                )}
            </div>
        </>
    );
};

export default SubmissionReview;