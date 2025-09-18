import { useState } from "react";
import LabeledInput from "./LabeledInput";
import Navbar from "../Navbar/Navbar";
import { submitFormData } from "../../services/api";
import SurfaceReadingsInput from "./SurfaceReadings";
import AuthorsInput from "./AuthorsInput";
import PDFUploader from "../PDFUploader/PDFUploader";
import "./FormInput.css";

const FormInput = ({ setUser, user, isAuthorized }) => {
  const [form, setForm] = useState({
    element: "",
    material: "",
    technique: "",
    precursor: "",
    coreactant: "",
    temperature: "",
    publication: {
      authors: [""],
      journal: "",
      year: "",
      doi: "",
    },
  });

  const [surfaces, setSurfaces] = useState([
    {
      surface: "",
      pretreatment: "",
      rawData: "",
    },
  ]);

  const [status, setStatus] = useState("");
  const [isPDFLoading, setIsPDFLoading] = useState(false);
  const [extractionConfidence, setExtractionConfidence] = useState(null);

  const sections = [
    {
      title: "Material Information",
      fields: [
        { id: "element", label: "Element", icon: "⚛️" },
        { id: "material", label: "Material", icon: "🧪" },
        { id: "technique", label: "Technique of Deposition", icon: "🔧" },
      ],
    },
    {
      title: "Process Parameters",
      fields: [
        { id: "precursor", label: "Precursor", icon: "🔄" },
        { id: "coreactant", label: "Co-reactant", icon: "⚡" },
        {
          id: "temperature",
          label: "Temperature (°C)",
          type: "number",
          icon: "🌡️",
        },
      ],
    },
    {
      title: "Publication Details",
      fields: [
        {
          id: "publication.journal",
          label: "Journal Abbreviation",
          icon: "📰",
          placeholder: "e.g., ACS Nano",
        },
        {
          id: "publication.year",
          label: "Publication Year",
          icon: "📅",
          type: "number",
          placeholder: "e.g., 2023",
        },
        {
          id: "publication.doi",
          label: "DOI",
          icon: "🔗",
          placeholder: "e.g., 10.1021/example",
        },
      ],
    },
  ];

  const handlePDFDataExtracted = (extractedData, confidence) => {
    setForm((prev) => ({
      ...prev,
      element: extractedData.element || prev.element,
      material: extractedData.material || prev.material,
      technique: extractedData.technique || prev.technique,
      precursor: extractedData.precursor || prev.precursor,
      coreactant: extractedData.coreactant || prev.coreactant,
    }));

    // Update surfaces if data is available
    if (extractedData.surface || extractedData.pretreatment) {
      setSurfaces([
        {
          surface: extractedData.surface || "",
          pretreatment: extractedData.pretreatment || "",
          rawData: "",
        },
      ]);
    }

    setExtractionConfidence(confidence);
    setStatus(
      `PDF data extracted successfully! Confidence: ${confidence}. Please review and complete the form.`
    );
  };

  const handleChange = (e) => {
    const { id, value } = e.target;
    if (id.includes(".")) {
      const [parent, child] = id.split(".");
      setForm((prev) => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value,
        },
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        [id]: value,
      }));
    }
  };

  const handleSurfaceAdd = () => {
    setSurfaces([
      ...surfaces,
      {
        surface: "",
        pretreatment: "",
        rawData: "",
      },
    ]);
  };

  const handleSurfaceRemove = (index) => {
    setSurfaces(surfaces.filter((_, i) => i !== index));
  };

  const handleSurfaceDataChange = (index, field, value) => {
    const newSurfaces = [...surfaces];
    newSurfaces[index][field] = value;
    setSurfaces(newSurfaces);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !form.publication.authors.some((author) => author.trim()) ||
      !form.publication.journal ||
      !form.publication.year
    ) {
      setStatus(
        "Please fill in at least one author and all other publication details"
      );
      return;
    }

    const year = parseInt(form.publication.year);
    if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
      setStatus("Please enter a valid publication year");
      return;
    }

    try {
      for (const surfaceData of surfaces) {
        const readings = surfaceData.rawData
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((line) => {
            const [cycle, thickness] = line.split(/\t|,|\s+/);
            return {
              cycles: parseFloat(cycle),
              thickness: parseFloat(thickness),
            };
          })
          .filter(
            (reading) => !isNaN(reading.cycles) && !isNaN(reading.thickness)
          );

        const submission = {
          ...form,
          surface: surfaceData.surface,
          pretreatment: surfaceData.pretreatment,
          readings,
        };

        await submitFormData(submission, user);
      }

      setStatus("All data saved successfully!");
      setSurfaces([{ surface: "", pretreatment: "", rawData: "" }]);
      setForm({
        element: "",
        material: "",
        technique: "",
        precursor: "",
        coreactant: "",
        temperature: "",
        publication: {
          author: "",
          journal: "",
          year: "",
          doi: "",
        },
      });
    } catch (error) {
      setStatus("Failed to save data");
      console.error("Error submitting data:", error);
    }
  };

  return (
    <>
      <Navbar setUser={setUser} isAuthorized={isAuthorized} />
      <div className="form-page">
        <h1 className="form-title">Submit New Data</h1>
        <form onSubmit={handleSubmit} className="form-container">
          <div className="form-sections">
            <h2 className="section-title">
              <span className="field-icon">🤖</span>
              AI-Assisted Data Extraction
            </h2>
            <PDFUploader
              onDataExtracted={handlePDFDataExtracted}
              isLoading={isPDFLoading}
              setIsLoading={setIsPDFLoading}
            />
            {extractionConfidence && (
              <div
                className={`confidence-indicator confidence-${extractionConfidence}`}
              >
                Extraction Confidence: {extractionConfidence.toUpperCase()}
              </div>
            )}
            {sections.map((section) => (
              <div key={section.title} className="form-section">
                <h2 className="section-title">{section.title}</h2>
                <div className="section-fields">
                  {section.fields.map(
                    ({ id, label, icon, type, fullWidth }) => (
                      <div
                        key={id}
                        className={`field-container ${
                          fullWidth ? "full-width" : ""
                        }`}
                      >
                        <span className="field-icon">{icon}</span>
                        <LabeledInput
                          id={id}
                          label={label}
                          type={type}
                          value={form[id]}
                          onChange={handleChange}
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
            <div className="form-section">
              <h2 className="section-title">
                <span className="field-icon">👤</span>
                Authors
              </h2>
              <AuthorsInput
                authors={form.publication.authors || [""]}
                onAuthorsChange={(authors) =>
                  setForm((prev) => ({
                    ...prev,
                    publication: {
                      ...prev.publication,
                      authors,
                    },
                  }))
                }
              />
            </div>
            <div className="form-section">
              <h2 className="section-title">
                <span className="field-icon">🔍</span>
                Surface Details and Measurements
              </h2>
              <SurfaceReadingsInput
                surfaces={surfaces}
                onSurfaceAdd={handleSurfaceAdd}
                onSurfaceRemove={handleSurfaceRemove}
                onDataChange={handleSurfaceDataChange}
              />
            </div>
          </div>

          <button type="submit" className="submit-btn">
            <span className="button-icon">💾</span>
            Submit Data
          </button>

          {status && (
            <div
              className={`status-message ${
                status.includes("success") ? "success" : "error"
              }`}
            >
              {status}
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default FormInput;
