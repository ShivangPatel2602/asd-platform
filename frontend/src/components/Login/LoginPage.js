import React, { useState } from 'react';
import config from '../../config';
import './LoginPage.css';
import googleimg from '../../images/google.webp'

const LoginPage = () => {
    const [activeTab, setActiveTab] = useState('login');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        university: '',
        department: '',
        purpose: '',
        status: ''
    })
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAccessRequest = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await fetch(`${config.BACKEND_API_URL}/api/request-access`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                setMessage("Access request submitted successfully. You will receive an email once approved.");
                setFormData({
                    name: '',
                    email: '',
                    university: '',
                    department: '',
                    purpose: '',
                    status: ''
                });
            } else {
                const data = await response.json();
                setMessage(data.message || 'Failed to submit request');
            }
        } catch (error) {
            setMessage("Error submitting request. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        window.location.href = `${config.BACKEND_API_URL}/api/auth/google`;
    }

    return (
        <div className='login-page-wrapper'>
            <div className='login-container'>
                <h1 className='login-title'>Welcome to ASD Platform</h1>
                <div className='tab-buttons'>
                    <button
                        className={`tab-button ${activeTab === 'login' ? 'active' : ''}`}
                        onClick={() => setActiveTab('login')}
                    >
                        <span className="icon">🔐</span>
                        Login
                    </button>
                    <button
                        className={`tab-button ${activeTab === 'request' ? 'active' : ''}`}
                        onClick={() => setActiveTab('request')}
                    >
                        <span className="icon">📝</span>
                        Request Access
                    </button>
                </div>

                {new URLSearchParams(window.location.search).get('error') === 'not_approved' && (
                    <div className='message error'>
                        <span className="icon">⚠️</span>
                        You need to request access before logging in. Please submit an access request.
                    </div>
                )}

                {message && <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
                    <span className="icon">{message.includes('successfully') ? '✅' : '⚠️'}</span>
                    {message}
                </div>}

                <div className='form-section'>
                    {activeTab === 'login' ? (
                        <div className="login-options">
                            <p className="login-description">Sign in to access ASD research data and tools</p>
                            <button className='google-btn' onClick={handleGoogleLogin}>
                                <img src={googleimg} alt="Google logo" />
                                Continue with Google
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleAccessRequest} className='access-request-form'>
                            <div className='form-group'>
                                <input 
                                type='text' 
                                placeholder='Full Name' 
                                name='name' 
                                value={formData.name} 
                                onChange={handleChange} 
                                required 
                                />
                            </div>
                            <div className='form-group'>
                                <input 
                                type='email' 
                                placeholder='Email' 
                                name='email' 
                                value={formData.email} 
                                onChange={handleChange} 
                                required 
                                />
                            </div>
                            <div className='form-group'>
                                <input 
                                    type='text' 
                                    placeholder='University/Institution' 
                                    name='university' 
                                    value={formData.university} 
                                    onChange={handleChange} 
                                    required 
                                />
                            </div>
                            <div className='form-group'>
                                <input 
                                    type='text' 
                                    placeholder='Department' 
                                    name='department' 
                                    value={formData.department} 
                                    onChange={handleChange} 
                                    required 
                                />
                            </div>
                            <div className='form-group'>
                                <select 
                                    name='status' 
                                    value={formData.status} 
                                    onChange={handleChange}
                                    required
                                >
                                    <option value=''>Select Status</option>
                                    <option value='student'>Student</option>
                                    <option value='faculty'>Faculty</option>
                                    <option value='researcher'>Researcher</option>
                                </select>
                            </div>
                            <div className='form-group'>
                                <textarea 
                                    placeholder='Purpose of Access' 
                                    name='purpose' 
                                    value={formData.purpose} 
                                    onChange={handleChange} 
                                    required 
                                />
                            </div>
                            <button 
                                type='submit' 
                                className={`submit-btn ${isLoading ? 'loading' : ''}`}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Submitting...
                                    </>
                                ) : (
                                    <>
                                        <span className="icon">📨</span>
                                        Request Access
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;