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
          element={!user ? <LoginPage /> : <Navigate to="/dashboard" />}
        />
        <Route
          path="/dashboard"
          element={
            user ? (
              <LandingPage setUser={setUser} isAuthorized={isAuthorized} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/comparison"
          element={
            user ? (
              <MaterialSelector setUser={setUser} isAuthorized={isAuthorized} />
            ) : (
              <Navigate to="/" />
            )
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
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/review-submissions"
          element={
            user && isAuthorized ? (
              <SubmissionReview setUser={setUser} isAuthorized={isAuthorized} />
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/edit-data/:element"
          element={<EditData setUser={setUser} isAuthorized={isAuthorized} />}
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
