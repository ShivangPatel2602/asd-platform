import React, {useState, useEffect} from "react";
import Navbar from "../Navbar/Navbar";
import { useNavigate } from 'react-router-dom';
import "./LandingPage.css";
import image from "../../images/ASD - Process.png";
import { periodicTableGroups } from "../../data/elements";

const LandingPage = ({ setUser }) => {
    const [user, setLocalUser] = useState(() => {
        const storedUser = localStorage.getItem("user");
        return storedUser ? JSON.parse(storedUser) : null;
    });
    const [selectedGroup, setSelectedGroup] = useState("");
    const [selectedElement, setSelectedElement] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        if (!user) {
            navigate("/");
        }
    }, [user, navigate]);

    const handleGroupChange = (e) => {
        setSelectedGroup(e.target.value);
        setSelectedElement("");
    }

    const handleElementChange = (e) => {
        setSelectedElement(e.target.value);
    }

    const handleExplore = () => {
        if (selectedElement) {
            navigate(`/comparison?element=${selectedElement}`);
        }
    }

    return (
        <>
            <Navbar setUser={setUser} />
            <section className="intro-section">
                <div className="left">
                    <h2>What Is ASD??</h2>
                    {user && <p>Welcome, {user.name || user.email}!</p>}
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
                        <select id="groupno" value={selectedGroup} onChange={handleGroupChange}>
                            <option value="">Select a group</option>
                            {Object.keys(periodicTableGroups).map((group) => (
                                <option key={group} value={group}>
                                    Group {group}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="elementname">Select Element</label>
                        <select
                            id="elementname"
                            value={selectedElement}
                            onChange={handleElementChange}
                            disabled={!selectedGroup}
                        >
                            <option value="">Select an element</option>
                            {selectedGroup && periodicTableGroups[selectedGroup].map((element) => (
                                <option key={element} value={element}>
                                    {element}
                                </option>
                            ))}
                        </select>
                    </div>
                    <button className="explore-btn" onClick={handleExplore} disabled={!selectedElement}>
                        Explore Further
                    </button>
                </div>
            </section>
        </>
    )
};

export default LandingPage;