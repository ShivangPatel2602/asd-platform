import React from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../Navbar/Navbar";
import "./DashboardLandingPage.css";

const cards = [
  {
    icon: "🧪",
    title: "Material-wise Data",
    description:
      "View and compare data by selecting a material from the periodic table.",
    button: "Go to Material Table",
    route: "/select/material",
  },
  {
    icon: "🧱",
    title: "Surface-wise Data",
    description:
      "View and compare data by selecting a surface from the periodic table.",
    button: "Go to Surface Table",
    route: "/select/surface",
  },
  {
    icon: "⬆️",
    title: "Upload Data",
    description: "Contribute your own data to the platform.",
    button: "Upload Data",
    route: "/upload-data",
  },
  {
    icon: "🔎",
    title: "Filter Data",
    description: "Filter and explore data with advanced options.",
    button: "Go to Filter",
    route: "/filter",
  },
];

const DashboardLandingPage = ({ setUser, isAuthorized, user }) => {
  const navigate = useNavigate();

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} user={user} />
      <div className="dashboard-landing-container">
        <h1 className="dashboard-title">Welcome to the ASD Platform</h1>
        <div className="dashboard-cards">
          {cards.map((card, idx) => (
            <div className="dashboard-card" key={idx}>
              <div className="dashboard-card-icon">{card.icon}</div>
              <div className="dashboard-card-title">{card.title}</div>
              <div className="dashboard-card-desc">{card.description}</div>
              <button
                className="dashboard-card-btn"
                onClick={() => navigate(card.route)}
              >
                {card.button}
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default DashboardLandingPage;
