import config from "../config";

const API_BASE_URL = `${config.BACKEND_API_URL}/api`;

export const submitFormData = async (data, user) => {
    const submissionData = {
        element: data.element,
        material: data.material,
        technique: data.technique,
        precursor: data.precursor,
        coreactant: data.coreactant,
        temperature: data.temperature,
        publication: data.publication,
        surface: data.surface,
        pretreatment: data.pretreatment,
        readings: data.readings,
        submittedBy: {
            email: user.email,
            name: user.name || 'Unknown',
            timestamp: new Date().toISOString()
        }
    };

    const response = await fetch(`${API_BASE_URL}/data`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(submissionData)
    })

    if (!response.ok) {
        throw new Error("Failed to submit form data.");
    }

    return response.json();
}