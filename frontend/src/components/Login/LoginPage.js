import React, { useState } from 'react';
import './LoginPage.css';

const LoginPage = ({ onLogin }) => {
    const [activeTab, setActiveTab] = useState('login');
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        username: '',
        confirmPassword: ''
    })

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setFormData({
            email: '',
            password: '',
            username: '',
            confirmPassword: ''
        });
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:5000/api/auth/google';
    }

    return (
        <div className='login-container'>
            <div className='tab-buttons'>
                <button
                    className={activeTab === 'login' ? 'active' : ''}
                    onClick={() => handleTabChange('login')}
                >
                    Login
                </button>
                <button
                    className={activeTab === 'register' ? 'active' : ''}
                    onClick={() => handleTabChange('register')}
                >
                    Register
                </button>
            </div>

            <div className='form-section'>
                {activeTab === 'login' ? (
                    <>
                        <input type='email' placeholder='Email' name='email' value={formData.email} onChange={handleChange} />
                        <input type='password' placeholder='Password' name='password' value={formData.password} onChange={handleChange} />
                        <button className='submit-btn'>Login</button>
                    </>
                ) : (
                    <>
                        <input type='text' placeholder='Username' name='username' value={formData.username} onChange={handleChange} />
                        <input type='email' placeholder='Email' name='email' value={formData.email} onChange={handleChange} />
                        <input type='password' placeholder='Password' name='password' value={formData.password} onChange={handleChange} />
                        <input type='password' placeholder='Confirm Password' name='confirmPassword' value={formData.confirmPassword} onChange={handleChange} />
                        <button className='submit-btn'>Register</button>
                    </>
                )}

                <div className='separator'>OR</div>
                <button className='google-btn' onClick={handleGoogleLogin}>
                    Continue with Google
                </button>
            </div>
        </div>
    );
};

export default LoginPage;