import React from "react";
import "./LabeledInput.css";

const LabeledInput = ({
    id, 
    label, 
    value, 
    onChange, 
    required = true, 
    type = "text", 
    placeholder = "",
    icon
}) => (
    <div className="labeled-input">
        <label htmlFor={id}>
            {label}
            {required && <span className="required-marker">*</span>}
        </label>
        <div className="input-wrapper">
            {icon && <span className="input-icon">{icon}</span>}
            <input 
                id={id}
                name={id}
                type={type}
                placeholder={placeholder || label}
                value={value}
                onChange={onChange}
                required={required}
                className={icon ? 'with-icon' : ''}
            />
        </div>
        {type === "number" && <div className="input-hint">Enter numeric value only</div>}
    </div>
);

export default LabeledInput;