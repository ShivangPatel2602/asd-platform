import React, {useState, useEffect} from 'react';
import { HashRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import config from './config';
import LoginPage from './components/Login/LoginPage';
import LandingPage from './components/LandingPage/LandingPage';
import FormInput from './components/Form/FormInput';
import MaterialSelector from './components/Comparison/Comparison';
import "./App.css";

function App() {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem("user");
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${config.BACKEND_API_URL}/api/user`, {
          credentials: "include",
        });
        if (response.ok) {
          const userData = await response.json();
          localStorage.setItem("user", JSON.stringify(userData));
          setUser(userData);
        }
      } catch(error) {
      console.error("Error fetching user data:", error);
      }
    };

    if (!user) {
      fetchUser();
    }
  }, [user]);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          !user ?  
          <LoginPage /> :
          <Navigate to="/dashboard" />
          } 
        />
        <Route path="/dashboard" element={
          user ?
          <LandingPage setUser={setUser} /> :
          <Navigate to="/" />
          }
        />
        <Route path="/comparison" element={
          user ?
          <MaterialSelector element={null} /> :
          <Navigate to="/" />
          }
        />
        <Route path="/upload-data" element={
          user ?
          <FormInput setUser={setUser} /> :
          <Navigate to="/" />
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;