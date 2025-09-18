import React from "react";
import { useParams } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import PeriodicTable from "../PeriodicTable/PeriodicTable";

const typeToEndpoint = {
  material: "elements-with-data",
  surface: "surfaces-with-data",
};

const typeToTitle = {
  material: "Select a Material",
  surface: "Select a Surface",
};

const PeriodicTableSelection = ({ setUser, isAuthorized, user }) => {
  const { type } = useParams();

  const endpoint = typeToEndpoint[type] || typeToEndpoint.material;
  const title = typeToTitle[type] || typeToTitle.material;

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div
        style={{
          background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
          minHeight: "100vh",
          padding: "32px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1400,
            margin: "0 auto",
            background: "rgba(255, 255, 255, 0.8)",
            backdropFilter: "blur(10px)",
            borderRadius: "24px",
            padding: "40px",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.1)",
          }}
        >
          <h2
            style={{
              textAlign: "center",
              marginBottom: 40,
              fontSize: "2.5rem",
              background: "linear-gradient(135deg, #0369a1 0%, #0284c7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: "700",
            }}
          >
            {title}
          </h2>
          <PeriodicTable type={type} endpoint={endpoint} />
        </div>
      </div>
    </>
  );
};

export default PeriodicTableSelection;
