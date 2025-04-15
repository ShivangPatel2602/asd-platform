const API_BASE_URL = "http://localhost:5000/api";

export const submitFormData = async (data) => {
    const response = await fetch(`${API_BASE_URL}/data`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    })

    if (!response.ok) {
        throw new Error("Failed to submit form data.");
    }

    return response.json();
}