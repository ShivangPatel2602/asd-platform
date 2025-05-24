import React from "react";
import {Link, useNavigate} from "react-router-dom";
import config from "../../config";
import './Navbar.css';

const Navbar = ({ setUser, isAuthorized }) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            const response = await fetch(`${config.BACKEND_API_URL}/api/logout`, {
                method: "POST",
                credentials: "include",
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Origin': window.location.origin
                }
            });

            if (response.ok) {
                setUser(null);
                navigate("/");
            }
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };
    
    return (
        <nav className="navbar">
            <div className="navbar-left">
                <Link to="/" className="nav-link">Home</Link>
            </div>
            <div className="navbar-right">
                <Link to="/upload-data" className="nav-link">Upload Data</Link>
                {isAuthorized && (
                    <Link to="/review-submissions" className="nav-link">Review Submissions</Link>
                )}
                <Link to="/search-papers" className="nav-link">Search Papers</Link>
                <Link to="/know-more" className="nav-link">Know More</Link>
                <button className="nav-link logout-btn" onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    );
};

export default Navbar;