import React from "react";
import {Link, useNavigate} from "react-router-dom";
import config from "../../config";
import './Navbar.css';

const Navbar = ({ setUser }) => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await fetch(`${config.BACKEND_API_URL}/logout`, {
                method: "GET",
                credentials: "include"
            });

            localStorage.removeItem("user");
            setUser(null);
            navigate("/");  // Redirect to Home
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
                <Link to="/compare-asd" className="nav-link">Compare ASD</Link>
                <Link to="/search-papers" className="nav-link">Search Papers</Link>
                <Link to="/know-more" className="nav-link">Know More</Link>
                <button className="nav-link logout-btn" onClick={handleLogout}>Logout</button>
            </div>
        </nav>
    );
};

export default Navbar;