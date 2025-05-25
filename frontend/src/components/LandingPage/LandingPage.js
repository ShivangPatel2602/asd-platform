import {useState} from "react";
import Navbar from "../Navbar/Navbar";
import PeriodicTable from "../PeriodicTable/PeriodicTable";
import { useNavigate } from 'react-router-dom';
import "./LandingPage.css";
import image from "../../images/ASD - Process.png";

const LandingPage = ({ setUser, isAuthorized }) => {
    const navigate = useNavigate();

    return (
        <>
            <Navbar setUser={setUser} isAuthorized={isAuthorized} />
            <section className="intro-section">
                <div className="left">
                    <h2>What Is ASD??</h2>
                    <div className="asd-content">
                        <div className="asd-description">
                            <p>
                                Area-Selective Deposition (ASD) is a technique used in nanofabrication that enables precise material deposition only on desired regions of substrate. It allows better control over patterning, minimizing the need for complex lithography steps.
                            </p>
                        </div>
                        <div className="asd-image">
                        <img src={image} alt="ASD" /> 
                        </div>
                    </div>
                </div>

                <div className="periodic-table-section">
                    <h2>Select an Element to Explore</h2>
                    <PeriodicTable />
                </div>
            </section>
        </>
    )
};

export default LandingPage;