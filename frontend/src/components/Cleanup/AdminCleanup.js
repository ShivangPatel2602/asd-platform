import React, { useState } from "react";
import config from "../../config";
import Navbar from "../Navbar/Navbar";

const AdminCleanup = ({ setUser, isAuthorized, user }) => {
  const [cleanupStatus, setCleanupStatus] = useState("");

  const handleCleanupAuthors = async () => {
    if (
      !window.confirm(
        "This will clean up all author fields in the database. Continue?"
      )
    ) {
      return;
    }

    setCleanupStatus("Processing...");

    try {
      const response = await fetch(
        `${config.BACKEND_API_URL}/api/initialize-publication-fields`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const result = await response.json();

      if (response.ok) {
        setCleanupStatus(`✓ ${result.message}`);
      } else {
        setCleanupStatus(`✗ Error: ${result.error}`);
      }
    } catch (error) {
      setCleanupStatus(`✗ Failed: ${error.message}`);
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
        <h2>Database Cleanup</h2>

        {!isAuthorized && (
          <div
            style={{ color: "red", padding: "20px", backgroundColor: "#fee" }}
          >
            You must be an authorized user to perform database maintenance.
          </div>
        )}

        {isAuthorized && (
          <div
            style={{
              padding: "20px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
            }}
          >
            <h3>Author Field Migration</h3>
            <p>
              This will convert all old 'author' fields to 'authors' arrays and
              remove duplicates.
            </p>
            <button
              onClick={handleCleanupAuthors}
              style={{
                padding: "12px 24px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontSize: "16px",
                borderRadius: "4px",
              }}
            >
              Run Cleanup
            </button>

            {cleanupStatus && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "15px",
                  backgroundColor: cleanupStatus.startsWith("✓")
                    ? "#d4edda"
                    : "#f8d7da",
                  border: `1px solid ${
                    cleanupStatus.startsWith("✓") ? "#c3e6cb" : "#f5c6cb"
                  }`,
                  borderRadius: "4px",
                }}
              >
                {cleanupStatus}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default AdminCleanup;
