import { useState } from "react";
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

    const sections = [
        {
            title: "Material Information",
            fields: [
                { id: "element", label: "Element", icon: "⚛️" },
                { id: "material", label: "Material", icon: "🧪" },
            ]
        },
        {
            title: "Process Parameters",
            fields: [
                { id: "precursor", label: "Precursor", icon: "🔄" },
                { id: "coreactant", label: "Co-reactant", icon: "⚡" },
                { id: "temperature", label: "Temperature (°C)", type: "number", icon: "🌡️" }
            ]
        },
        {
            title: "Surface Details",
            fields: [
                { id: "surface", label: "Surface", icon: "📏" },
                { id: "pretreatment", label: "Pre-treatment", icon: "🧹" },
            ]
        },
        {
            title: "Publication Details",
            fields: [
                { id: "publication", label: "Publication / DOI", icon: "📚", fullWidth: true }
            ]
        }
    ];

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
            <div className="form-page">
                <h1 className="form-title">Submit New Data</h1>
                <form onSubmit={handleSubmit} className="form-container">
                    <div className="form-sections">
                        {sections.map((section) => (
                            <div key={section.title} className="form-section">
                                <h2 className="section-title">
                                    {section.title}
                                </h2>
                                <div className="section-fields">
                                    {section.fields.map(({ id, label, icon, type, fullWidth }) => (
                                        <div key={id} className={`field-container ${fullWidth ? 'full-width' : ''}`}>
                                            <span className="field-icon">{icon}</span>
                                            <LabeledInput 
                                                id={id} 
                                                label={label} 
                                                type={type}
                                                value={form[id]} 
                                                onChange={handleChange}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}

                        <div className="form-section">
                            <h2 className="section-title">
                                <span className="field-icon">📊</span>
                                Cycle vs Thickness Data
                            </h2>
                            <div className="readings-section">
                                <textarea 
                                    id="cvst"
                                    rows="10"
                                    placeholder="Paste your cycle vs thickness data here...&#10;Format: cycle thickness&#10;Example:&#10;0 0&#10;10 0.5&#10;20 1.0"
                                    value={rawData}
                                    onChange={(e) => setRawData(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <button type="submit" className="submit-btn">
                        <span className="button-icon">💾</span>
                        Submit Data
                    </button>

                    {status && (
                        <div className={`status-message ${status.includes('success') ? 'success' : 'error'}`}>
                            {status}
                        </div>
                    )}
                </form>
            </div>
        </>
    );
};

export default FormInput;