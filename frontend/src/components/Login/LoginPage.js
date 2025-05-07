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
        <div className='login-container'>
            <div className='tab-buttons'>
                <button
                    className={activeTab === 'login' ? 'active' : ''}
                    onClick={() => setActiveTab('login')}
                >
                    Login
                </button>
                <button
                    className={activeTab === 'request' ? 'active' : ''}
                    onClick={() => setActiveTab('request')}
                >
                    Request Access
                </button>
            </div>

            {new URLSearchParams(window.location.search).get('error') === 'not_approved' && (
                <div className='message error'>
                    You need to request access before logging in. Please submit an access request.
                </div>
            )}

            {message && <div className='message'>{message}</div>}

            <div className='form-section'>
                {activeTab === 'login' ? (
                    <>
                        <button className='google-btn' onClick={handleGoogleLogin}>
                            <img 
                                src={googleimg}
                                alt="Google logo" 
                            />
                            Continue with Google
                        </button>
                    </>
                ) : (
                    <form onSubmit={handleAccessRequest}>
                        <input 
                            type='text' 
                            placeholder='Full Name' 
                            name='name' 
                            value={formData.name} 
                            onChange={handleChange} 
                            required 
                        />
                        <input 
                            type='email' 
                            placeholder='Email' 
                            name='email' 
                            value={formData.email} 
                            onChange={handleChange} 
                            required 
                        />
                        <input 
                            type='text' 
                            placeholder='University/Institution' 
                            name='university' 
                            value={formData.university} 
                            onChange={handleChange} 
                            required 
                        />
                        <input 
                            type='text' 
                            placeholder='Department' 
                            name='department' 
                            value={formData.department} 
                            onChange={handleChange} 
                            required 
                        />
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
                        <textarea 
                            placeholder='Purpose of Access' 
                            name='purpose' 
                            value={formData.purpose} 
                            onChange={handleChange} 
                            required 
                        />
                        <button 
                            type='submit' 
                            className='submit-btn'
                            disabled={isLoading}
                        >
                            {isLoading ? 'Submitting...' : 'Request Access'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default LoginPage;