import React from "react";
import Navbar from "../Navbar/Navbar";
import "./LandingPage.css";
import image from "../../images/ASD - Process.png"

const LandingPage = () => {
    return (
        <>
            <Navbar />
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

                <div className="right">
                    <h2>Get Started</h2>
                    <div className="form-group">
                        <label htmlFor="groupno">Select Group No.</label>
                        <input type="number" id="groupno" placeholder="Group No." />
                    </div>
                    <div className="form-group">
                        <label htmlFor="elementname">Select Group No.</label>
                        <input type="text" id="elementname" placeholder="Element" />
                    </div>
                    <button className="explore-btn">Explore Further</button>
                </div>
            </section>
        </>
    )
};

export default LandingPage;