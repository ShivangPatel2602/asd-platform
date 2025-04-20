import React, {useState} from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './components/Login/LoginPage';
import LandingPage from './components/LandingPage/LandingPage';
import Navbar from './components/Navbar/Navbar';
import FormInput from './components/Form/FormInput';
import "./App.css";

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  return (
    <Router>
      <Routes>
        <Route path='/' element={
          !user ? 
          // <LoginPage onLogin={setUser} /> 
          <LandingPage />
          :
          <Navigate to="/dashboard" />
          } 
        />
        <Route path='/dashboard' element={
          user ?
          <LandingPage /> :
          <Navigate to="/" />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;