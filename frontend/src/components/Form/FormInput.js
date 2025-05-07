import React, { useState } from "react";
import LabeledInput from "./LabeledInput";
import Navbar from "../Navbar/Navbar";
import { submitFormData } from "../../services/api";
import "./FormInput.css";

const FormInput = ({setUser, user}) => {
    const [form, setForm] = useState({
        element: "",
        material: "",
        precursor: "",
        coreactant: "",
        surface: "",
        pretreatment: "",
        temperature: "",
        publication: "",
        readings: [{ cycles: "", thickness: "" }],
    });
    const [rawData, setRawData] = useState('');
    const [dataPoints, setDataPoints] = useState([]);

    const [status, setStatus] = useState("");

    const handleChange = (e) => {
        setForm({
            ...form,    
            [e.target.name]: e.target.value,
        });
    }

    const handleSubmit = async (e) => {
        e.preventDefault();

        const rows = rawData
            .split("\n")
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        const parsed = rows.map(row => {
            const [cycle, thickness] = row.split(/\t|,|\s+/);
            const cycleNum = parseFloat(cycle);
            const thicknessNum = parseFloat(thickness);

            if (isNaN(cycleNum)) return null;

            return {
                cycles: cycleNum,
                thickness: isNaN(thicknessNum) ? null : thicknessNum
            };
        }).filter(point => point !== null);

        const updatedForm = {
            ...form,
            readings: parsed
        }

        try {
            await submitFormData(updatedForm, user);
            setStatus("Data saved successfully!");
            setRawData("");
            setDataPoints([]);
            setForm({
                element: "",
                material: "",
                precursor: "",
                coreactant: "",
                surface: "",
                pretreatment: "",
                temperature: "",
                publication: "",
                readings: [{ cycles: "", thickness: "" }],
            });
        } catch (error) {
            setStatus("Failed to save data");
        }
    };

    const fields = [
        { id: "element", label: "Element" },
        { id: "material", label: "Material" },
        { id: "precursor", label: "Precursor" },
        { id: "coreactant", label: "Co-reactant" },
        { id: "surface", label: "Surface" },
        { id: "pretreatment", label: "Pre-treatment" },
        { id: "temperature", label: "Temperature (°C)", type: "number" },
        { id: "publication", label: "Publication / DOI", fullWidth: true }
    ]

    return (
        <>
            <Navbar setUser={setUser} />
            <form onSubmit={handleSubmit} className="form-container">
                <div className="grid">
                    {fields.map(({ id, label, fullWidth }) => (
                        <div key={id} className={fullWidth ? "form-row" : ""}>
                            <LabeledInput id={id} label={label} value={form[id]} onChange={handleChange}/>
                        </div>
                    ))}
                </div>

                <div className="readings-section">
                    <label htmlFor="cvst">Cycle vs Thickness</label><br />
                    <textarea 
                        id="cvst"
                        rows="10"
                        cols="40"
                        placeholder="Paste Data Here"
                        value={rawData}
                        onChange={(e) => setRawData(e.target.value)}
                    />
                </div>

                <button type="submit" className="submit-btn">
                    Submit
                </button>

                {status && <p className="status-message">{status}</p>}
            </form>
        </>
    );
};

export default FormInput;