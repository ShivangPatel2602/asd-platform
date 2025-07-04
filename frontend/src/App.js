import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Route,
  Routes,
  Navigate,
} from "react-router-dom";
import config from "./config";
import LoginPage from "./components/Login/LoginPage";
import LandingPage from "./components/LandingPage/LandingPage";
import FormInput from "./components/Form/FormInput";
import MaterialSelector from "./components/Comparison/Comparison";
import SubmissionReview from "./components/Submissions/Submission";
import EditData from "./components/EditData/EditData";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      try {
        const response = await fetch(`${config.BACKEND_API_URL}/api/user`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Origin: window.location.origin,
          },
        });

        if (!mounted) return;

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthorized(userData.isAuthorized);
        } else {
          setUser(null);
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        if (mounted) {
          setUser(null);
          setIsAuthorized(false);
        }
      }
    };

    fetchUser();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage setUser={setUser} isAuthorized={isAuthorized} user={user} />
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/comparison"
          element={
            <MaterialSelector setUser={setUser} isAuthorized={isAuthorized} user={user} />
          }
        />
        <Route
          path="/upload-data"
          element={
            user ? (
              <FormInput
                setUser={setUser}
                user={user}
                isAuthorized={isAuthorized}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/review-submissions"
          element={
            user && isAuthorized ? (
              <SubmissionReview setUser={setUser} isAuthorized={isAuthorized} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/edit-data/:element"
          element={
            user ? (
              <EditData setUser={setUser} isAuthorized={isAuthorized} user={user} />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
