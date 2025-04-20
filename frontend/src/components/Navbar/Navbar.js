import React from "react";
import {Link} from "react-router-dom";
import './Navbar.css';

const Navbar = () => {
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
                <Link to="/logout" className="nav-link">Logout</Link>
            </div>
        </nav>
    );
};

export default Navbar;